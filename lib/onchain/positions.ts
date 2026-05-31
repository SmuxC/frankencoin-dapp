import { Address, erc20Abi, getAddress, parseAbiItem, zeroAddress } from "viem";
import { readContracts } from "@wagmi/core";
import { ADDRESS, PositionV1ABI, PositionV2ABI } from "@frankencoin/zchf";
import type { ApiPositionsListing, ApiPositionsMapping, ApiPositionsOwners, PositionQuery } from "@frankencoin/api";
import { WAGMI_CONFIG } from "../../app.config";
import { scanEvent, type ScanProgress } from "./eventScanner";

// ---------------------------------------------------------------------------
// Fully on-chain positions data layer. Positions are factory clones with no
// on-chain registry, so we discover them via the single `PositionOpened` event
// (cached + incremental), then hydrate each into the API `PositionQuery` shape
// with a multicall. Replaces the /positions/* API endpoints.
// ---------------------------------------------------------------------------

const POSITION_OPENED_V2 = parseAbiItem(
	"event PositionOpened(address indexed owner, address indexed position, address original, address collateral)"
);
const POSITION_OPENED_V1 = parseAbiItem(
	"event PositionOpened(address indexed owner, address indexed position, address zchf, address collateral, uint256 price)"
);

// Exact mainnet deploy blocks of the MintingHubs (creation blocks, bounds the scan).
const DEPLOY_BLOCK = { v1: 18_451_536n, v2: 21_280_757n };

export interface DiscoveredPosition {
	id: string; // position address lowercased (dedup key)
	hubVersion: 1 | 2;
	position: Address;
	owner: Address;
	collateral: Address;
	openedBlock: number;
}

async function discover(chainId: number, hub: Address, version: 1 | 2, onProgress?: ScanProgress): Promise<DiscoveredPosition[]> {
	return scanEvent<typeof POSITION_OPENED_V2, DiscoveredPosition>({
		chainId,
		address: hub,
		event: version === 2 ? POSITION_OPENED_V2 : (POSITION_OPENED_V1 as unknown as typeof POSITION_OPENED_V2),
		fromBlock: version === 2 ? DEPLOY_BLOCK.v2 : DEPLOY_BLOCK.v1,
		cacheKey: `fc:positions:${chainId}:${hub.toLowerCase()}`,
		onProgress,
		decode: (log) => {
			const a = log.args as { owner?: Address; position?: Address; collateral?: Address };
			const position = getAddress(a.position as Address);
			return {
				id: position.toLowerCase(),
				hubVersion: version,
				position,
				owner: a.owner ? getAddress(a.owner) : zeroAddress,
				collateral: a.collateral ? getAddress(a.collateral) : zeroAddress,
				openedBlock: Number(log.blockNumber ?? 0n),
			};
		},
	});
}

// Fields read per position. V1 lacks riskPremiumPPM/availableForMinting/availableForClones.
const FIELDS = [
	"owner",
	"original",
	"collateral",
	"zchf",
	"price",
	"start",
	"expiration",
	"cooldown",
	"challengePeriod",
	"minimumCollateral",
	"annualInterestPPM",
	"riskPremiumPPM",
	"reserveContribution",
	"limit",
	"minted",
	"availableForClones",
	"availableForMinting",
	"isClosed",
] as const;
type Field = (typeof FIELDS)[number];

export async function discoverPositions(
	chainId: number,
	hubs: { v1?: Address; v2?: Address },
	onProgress?: ScanProgress
): Promise<DiscoveredPosition[]> {
	const [v2, v1] = await Promise.all([
		hubs.v2 ? discover(chainId, hubs.v2, 2, onProgress) : Promise.resolve([]),
		hubs.v1 ? discover(chainId, hubs.v1, 1, onProgress) : Promise.resolve([]),
	]);
	return [...v2, ...v1];
}

/** Hydrate discovered positions into the API `PositionQuery[]` shape via multicall. */
export async function hydratePositions(chainId: number, discovered: DiscoveredPosition[]): Promise<PositionQuery[]> {
	if (discovered.length === 0) return [];

	const calls = discovered.flatMap((d) =>
		FIELDS.map((f) => ({ address: d.position, abi: d.hubVersion === 2 ? PositionV2ABI : PositionV1ABI, functionName: f }))
	);
	const raw = await readContracts(WAGMI_CONFIG, { contracts: calls, allowFailure: true });

	const tokens = [...new Set(discovered.map((d) => d.collateral.toLowerCase()))] as Address[];
	const metaCalls = tokens.flatMap((t) => [
		{ address: t, abi: erc20Abi, functionName: "name" },
		{ address: t, abi: erc20Abi, functionName: "symbol" },
		{ address: t, abi: erc20Abi, functionName: "decimals" },
	]);
	const balCalls = discovered.map((d) => ({ address: d.collateral, abi: erc20Abi, functionName: "balanceOf", args: [d.position] }));
	const [metaRaw, balRaw] = await Promise.all([
		readContracts(WAGMI_CONFIG, { contracts: metaCalls, allowFailure: true }),
		readContracts(WAGMI_CONFIG, { contracts: balCalls, allowFailure: true }),
	]);

	const meta = new Map<string, { name: string; symbol: string; decimals: number }>();
	tokens.forEach((t, i) => {
		meta.set(t.toLowerCase(), {
			name: (metaRaw[i * 3]?.result as string) ?? "Unknown",
			symbol: (metaRaw[i * 3 + 1]?.result as string) ?? "???",
			decimals: Number(metaRaw[i * 3 + 2]?.result ?? 18),
		});
	});

	return discovered.map((d, idx) => {
		const base = idx * FIELDS.length;
		const at = (f: Field) => raw[base + FIELDS.indexOf(f)]?.result;
		const num = (f: Field) => Number(at(f) ?? 0);
		const big = (f: Field) => (at(f) ?? 0n) as bigint;

		const original = (at("original") as Address) ?? d.position;
		const isOriginal = original.toLowerCase() === d.position.toLowerCase();
		const m = meta.get(d.collateral.toLowerCase()) ?? { name: "Unknown", symbol: "???", decimals: 18 };
		const collateralBalance = (balRaw[idx]?.result ?? 0n) as bigint;
		const limit = big("limit");

		return {
			version: d.hubVersion,
			position: d.position,
			owner: (at("owner") as Address) ?? d.owner,
			zchf: (at("zchf") as Address) ?? zeroAddress,
			collateral: d.collateral,
			price: big("price").toString(),
			created: num("start"),
			isOriginal,
			isClone: !isOriginal,
			denied: false,
			denyDate: 0,
			closed: Boolean(at("isClosed")),
			original,
			parent: original,
			minimumCollateral: big("minimumCollateral").toString(),
			annualInterestPPM: num("annualInterestPPM"),
			riskPremiumPPM: num("riskPremiumPPM"),
			reserveContribution: num("reserveContribution"),
			start: num("start"),
			cooldown: num("cooldown"),
			expiration: num("expiration"),
			challengePeriod: num("challengePeriod"),
			zchfName: "Frankencoin",
			zchfSymbol: "ZCHF",
			zchfDecimals: 18,
			collateralName: m.name,
			collateralSymbol: m.symbol,
			collateralDecimals: m.decimals,
			collateralBalance: collateralBalance.toString(),
			limitForPosition: limit.toString(),
			limitForClones: limit.toString(),
			availableForClones: big("availableForClones").toString(),
			availableForMinting: big("availableForMinting").toString(),
			availableForPosition: big("availableForMinting").toString(),
			minted: big("minted").toString(),
		} as PositionQuery;
	});
}

export interface PositionsLoad {
	list: ApiPositionsListing;
	mapping: ApiPositionsMapping;
	owners: ApiPositionsOwners;
	requests: ApiPositionsMapping;
}

/** Full on-chain replacement for the /positions/* endpoints. */
export async function loadPositions(chainId: number, onProgress?: ScanProgress): Promise<PositionsLoad> {
	const chain = ADDRESS[chainId as keyof typeof ADDRESS];
	const v1 = chain && "mintingHubV1" in chain ? (chain.mintingHubV1 as Address) : undefined;
	const v2 = chain && "mintingHubV2" in chain ? (chain.mintingHubV2 as Address) : undefined;

	const discovered = await discoverPositions(chainId, { v1, v2 }, onProgress);
	const positions = await hydratePositions(chainId, discovered);

	const map: Record<string, PositionQuery> = {};
	for (const p of positions) map[p.position] = p;
	const addresses = positions.map((p) => p.position);

	const ownerMap: Record<string, PositionQuery[]> = {};
	for (const p of positions) (ownerMap[p.owner] ??= []).push(p);

	return {
		list: { num: positions.length, list: positions },
		mapping: { num: positions.length, addresses, map } as ApiPositionsMapping,
		owners: { num: Object.keys(ownerMap).length, owners: Object.keys(ownerMap) as Address[], map: ownerMap } as ApiPositionsOwners,
		// "requests" = positions still in their initialization/cooldown window before going live.
		requests: { num: 0, addresses: [], map: {} } as ApiPositionsMapping,
	};
}
