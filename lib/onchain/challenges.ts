import { Address, getAddress, parseAbiItem } from "viem";
import { readContracts } from "@wagmi/core";
import { ADDRESS, MintingHubV2ABI } from "@frankencoin/zchf";
import {
	ApiChallengesChallengers,
	ApiChallengesListing,
	ApiChallengesMapping,
	ApiChallengesPositions,
	ApiChallengesPrices,
	ChallengesQueryStatus,
	type ChallengesId,
	type ChallengesQueryItem,
} from "@frankencoin/api";
import { WAGMI_CONFIG } from "../../app.config";
import { scanEvent } from "./eventScanner";

// ---------------------------------------------------------------------------
// On-chain challenges/auctions, replacing /challenges/*.
// Discover via ChallengeStarted scan, then read each challenge's current state
// (challenges(i)) and Dutch-auction price (price(i)) directly. A challenge is
// Active while its on-chain size > 0, else Succeeded/cleared.
// ---------------------------------------------------------------------------

const CHALLENGE_STARTED = parseAbiItem(
	"event ChallengeStarted(address indexed challenger, address indexed position, uint256 size, uint256 number)"
);
const HUB_V2_DEPLOY_BLOCK = 21_280_757n;

interface StartedRecord {
	id: string;
	number: string;
	position: Address;
	challenger: Address;
	size: string;
	txHash: string;
	created: number;
}

export interface ChallengesLoad {
	list: ApiChallengesListing;
	mapping: ApiChallengesMapping;
	challengers: ApiChallengesChallengers;
	positions: ApiChallengesPositions;
	prices: ApiChallengesPrices;
}

export async function loadChallenges(chainId: number): Promise<ChallengesLoad> {
	const chain = ADDRESS[chainId as keyof typeof ADDRESS];
	const hub = chain && "mintingHubV2" in chain ? (chain.mintingHubV2 as Address) : undefined;
	if (!hub) {
		return {
			list: { num: 0, list: [] },
			mapping: { num: 0, challenges: [], map: {} } as ApiChallengesMapping,
			challengers: { num: 0, challengers: [], map: {} } as ApiChallengesChallengers,
			positions: { num: 0, positions: [], map: {} } as ApiChallengesPositions,
			prices: { num: 0, ids: [], map: {} } as ApiChallengesPrices,
		};
	}

	const started = await scanEvent<typeof CHALLENGE_STARTED, StartedRecord>({
		chainId,
		address: hub,
		event: CHALLENGE_STARTED,
		fromBlock: HUB_V2_DEPLOY_BLOCK,
		cacheKey: `fc:challenges:${chainId}:${hub.toLowerCase()}`,
		decode: (log) => {
			const a = log.args as { challenger?: Address; position?: Address; size?: bigint; number?: bigint };
			const number = (a.number ?? 0n).toString();
			const position = getAddress(a.position as Address);
			return {
				id: `${position}-challenge-${number}`,
				number,
				position,
				challenger: a.challenger ? getAddress(a.challenger) : position,
				size: (a.size ?? 0n).toString(),
				txHash: log.transactionHash ?? "",
				created: Number(log.blockNumber ?? 0n),
			};
		},
	});

	// current state + auction price per challenge
	const stateCalls = started.flatMap((s) => [
		{ address: hub, abi: MintingHubV2ABI, functionName: "challenges", args: [BigInt(s.number)] },
		{ address: hub, abi: MintingHubV2ABI, functionName: "price", args: [Number(s.number)] },
	]);
	const res = await readContracts(WAGMI_CONFIG, { contracts: stateCalls, allowFailure: true });

	const list: ChallengesQueryItem[] = started.map((s, i) => {
		const cur = res[i * 2]?.result as readonly [Address, number, Address, bigint] | undefined;
		const curSize = cur ? cur[3] : 0n;
		const start = cur ? BigInt(cur[1]) : BigInt(s.created);
		const totalSize = BigInt(s.size);
		const filled = totalSize > curSize ? totalSize - curSize : 0n;
		return {
			version: 2,
			id: s.id as ChallengesId,
			position: s.position,
			number: BigInt(s.number),
			txHash: s.txHash as Address,
			challenger: s.challenger,
			start,
			created: BigInt(s.created),
			duration: 0n,
			size: totalSize,
			liqPrice: 0n,
			bids: 0n,
			filledSize: filled,
			acquiredCollateral: 0n,
			status: curSize > 0n ? ChallengesQueryStatus.Active : ChallengesQueryStatus.Success,
		};
	});

	const mappingMap: Record<string, ChallengesQueryItem> = {};
	const byPosition: Record<string, ChallengesQueryItem[]> = {};
	const byChallenger: Record<string, ChallengesQueryItem[]> = {};
	const pricesMap: Record<string, string> = {};
	list.forEach((c, i) => {
		mappingMap[c.id] = c;
		(byPosition[c.position] ??= []).push(c);
		(byChallenger[c.challenger] ??= []).push(c);
		pricesMap[c.id] = ((res[i * 2 + 1]?.result ?? 0n) as bigint).toString();
	});

	return {
		list: { num: list.length, list },
		mapping: { num: list.length, challenges: list.map((c) => c.id), map: mappingMap } as ApiChallengesMapping,
		challengers: {
			num: Object.keys(byChallenger).length,
			challengers: Object.keys(byChallenger) as Address[],
			map: byChallenger,
		} as ApiChallengesChallengers,
		positions: {
			num: Object.keys(byPosition).length,
			positions: Object.keys(byPosition) as Address[],
			map: byPosition,
		} as ApiChallengesPositions,
		prices: { num: list.length, ids: list.map((c) => c.id), map: pricesMap } as ApiChallengesPrices,
	};
}
