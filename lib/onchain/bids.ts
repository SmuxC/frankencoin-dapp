import { Address, getAddress, parseAbiItem } from "viem";
import { ADDRESS } from "@frankencoin/zchf";
import {
	ApiBidsBidders,
	ApiBidsChallenges,
	ApiBidsListing,
	ApiBidsMapping,
	ApiBidsPositions,
	BidsQueryType,
	type BidsId,
	type BidsQueryItem,
} from "@frankencoin/api";
import { scanEvent } from "./eventScanner";

// ---------------------------------------------------------------------------
// On-chain bids, replacing /challenges/bids/*.
// A bid is recorded on-chain as either ChallengeAverted (bid that averted the
// challenge) or ChallengeSucceeded (winning bid). We scan both. Note: the
// bidder address is not in the events (it's the tx sender), so bidder is left
// as the position address; bid economics (bid/acquiredCollateral/size) are exact.
// ---------------------------------------------------------------------------

const CHALLENGE_AVERTED = parseAbiItem("event ChallengeAverted(address indexed position, uint256 number, uint256 size)");
const CHALLENGE_SUCCEEDED = parseAbiItem(
	"event ChallengeSucceeded(address indexed position, uint256 number, uint256 bid, uint256 acquiredCollateral, uint256 challengeSize)"
);
const HUB_V2_DEPLOY_BLOCK = 21_280_757n;

type BidRecord = {
	id: string;
	challengeId: string;
	position: Address;
	number: string;
	type: BidsQueryType;
	bid: string;
	acquiredCollateral: string;
	challengeSize: string;
	txHash: string;
	created: number;
};

function toItem(r: BidRecord, idx: number): BidsQueryItem {
	return {
		version: 2,
		id: `${r.challengeId}-bid-${idx}` as BidsId,
		position: r.position,
		number: BigInt(r.number),
		numberBid: BigInt(idx),
		txHash: r.txHash as Address,
		bidder: r.position,
		created: BigInt(r.created),
		bidType: r.type,
		bid: BigInt(r.bid),
		price: 0n,
		filledSize: BigInt(r.acquiredCollateral),
		acquiredCollateral: BigInt(r.acquiredCollateral),
		challengeSize: BigInt(r.challengeSize),
	};
}

export interface BidsLoad {
	list: ApiBidsListing;
	mapping: ApiBidsMapping;
	bidders: ApiBidsBidders;
	challenges: ApiBidsChallenges;
	positions: ApiBidsPositions;
}

export async function loadBids(chainId: number): Promise<BidsLoad> {
	const chain = ADDRESS[chainId as keyof typeof ADDRESS];
	const hub = chain && "mintingHubV2" in chain ? (chain.mintingHubV2 as Address) : undefined;
	const empty: BidsLoad = {
		list: { num: 0, list: [] },
		mapping: { num: 0, bidIds: [], map: {} } as ApiBidsMapping,
		bidders: { num: 0, bidders: [], map: {} } as ApiBidsBidders,
		challenges: { num: 0, challenges: [], map: {} } as ApiBidsChallenges,
		positions: { num: 0, positions: [], map: {} } as ApiBidsPositions,
	};
	if (!hub) return empty;

	const decode =
		(type: BidsQueryType) =>
		(log: any): BidRecord => {
			const a = log.args as {
				position?: Address;
				number?: bigint;
				bid?: bigint;
				acquiredCollateral?: bigint;
				challengeSize?: bigint;
				size?: bigint;
			};
			const position = getAddress(a.position as Address);
			const number = (a.number ?? 0n).toString();
			return {
				id: `${position.toLowerCase()}-${number}-${type}-${log.blockNumber}`,
				challengeId: `${position}-challenge-${number}`,
				position,
				number,
				type,
				bid: (a.bid ?? 0n).toString(),
				acquiredCollateral: (a.acquiredCollateral ?? 0n).toString(),
				challengeSize: (a.challengeSize ?? a.size ?? 0n).toString(),
				txHash: log.transactionHash ?? "",
				created: Number(log.blockNumber ?? 0n),
			};
		};

	const [averted, succeeded] = await Promise.all([
		scanEvent<typeof CHALLENGE_AVERTED, BidRecord>({
			chainId,
			address: hub,
			event: CHALLENGE_AVERTED,
			fromBlock: HUB_V2_DEPLOY_BLOCK,
			cacheKey: `fc:bids:averted:${chainId}:${hub.toLowerCase()}`,
			decode: decode(BidsQueryType.Averted),
		}),
		scanEvent<typeof CHALLENGE_SUCCEEDED, BidRecord>({
			chainId,
			address: hub,
			event: CHALLENGE_SUCCEEDED,
			fromBlock: HUB_V2_DEPLOY_BLOCK,
			cacheKey: `fc:bids:succeeded:${chainId}:${hub.toLowerCase()}`,
			decode: decode(BidsQueryType.Succeeded),
		}),
	]);

	const list = [...averted, ...succeeded].map(toItem);

	const mappingMap: Record<string, BidsQueryItem> = {};
	const byPosition: Record<string, BidsQueryItem[]> = {};
	const byChallenge: Record<string, BidsQueryItem[]> = {};
	const records = [...averted, ...succeeded];
	list.forEach((b, i) => {
		mappingMap[b.id] = b;
		(byPosition[b.position] ??= []).push(b);
		(byChallenge[records[i].challengeId] ??= []).push(b);
	});

	return {
		list: { num: list.length, list },
		mapping: { num: list.length, bidIds: list.map((b) => b.id), map: mappingMap } as ApiBidsMapping,
		bidders: { num: 0, bidders: [], map: {} } as ApiBidsBidders,
		challenges: {
			num: Object.keys(byChallenge).length,
			challenges: Object.keys(byChallenge) as Address[],
			map: byChallenge,
		} as ApiBidsChallenges,
		positions: {
			num: Object.keys(byPosition).length,
			positions: Object.keys(byPosition) as Address[],
			map: byPosition,
		} as ApiBidsPositions,
	};
}
