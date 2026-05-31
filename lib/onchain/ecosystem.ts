import { Address, formatUnits, getAddress, parseAbiItem } from "viem";
import { readContracts } from "@wagmi/core";
import { FrankencoinABI, EquityABI } from "@frankencoin/zchf";
import { ChainId } from "@frankencoin/zchf";
import { contractsFor } from "./contracts";
import type {
	ApiEcosystemCollateralPositions,
	ApiEcosystemCollateralStats,
	ApiEcosystemFpsInfo,
	ApiEcosystemFrankencoinInfo,
	ApiEcosystemFrankencoinSupply,
	ApiMinterListing,
	MinterQuery,
} from "@frankencoin/api";
import { WAGMI_CONFIG } from "../../app.config";
import { scanEvent } from "./eventScanner";

// ---------------------------------------------------------------------------
// On-chain ecosystem stats, replacing /ecosystem/*.
// Frankencoin + Equity core values are direct reads. Minters are discovered via
// the MinterApplied event scan. Collateral positions/stats are derived elsewhere
// from the positions list; here they default to empty (TVL needs market prices,
// which are dropped). Fiat (usd/chf) values are 0 — liqPrice-only.
// ---------------------------------------------------------------------------

const MINTER_APPLIED = parseAbiItem(
	"event MinterApplied(address indexed minter, uint256 applicationPeriod, uint256 applicationFee, string message)"
);
const FRANKENCOIN_DEPLOY_BLOCK = 18_451_518n;

interface MinterRecord extends MinterQuery {
	id: string;
}

async function loadMinters(chainId: number, frankencoin: Address): Promise<ApiMinterListing> {
	const records = await scanEvent<typeof MINTER_APPLIED, MinterRecord>({
		chainId,
		address: frankencoin,
		event: MINTER_APPLIED,
		fromBlock: FRANKENCOIN_DEPLOY_BLOCK,
		cacheKey: `fc:minters:${chainId}:${frankencoin.toLowerCase()}`,
		decode: (log) => {
			const a = log.args as { minter?: Address; applicationPeriod?: bigint; applicationFee?: bigint; message?: string };
			const minter = getAddress(a.minter as Address);
			return {
				id: `${minter.toLowerCase()}-${log.blockNumber}`,
				chainId: chainId as ChainId,
				txHash: log.transactionHash ?? "",
				minter,
				applicationPeriod: Number(a.applicationPeriod ?? 0n),
				applicationFee: Number(a.applicationFee ?? 0n),
				applyMessage: a.message ?? "",
				applyDate: 0,
				suggestor: minter,
				denyMessage: null,
				denyDate: null,
				denyTxHash: null,
				vetor: null,
			};
		},
	});
	return { num: records.length, list: records };
}

export interface EcosystemLoad {
	frankencoinInfo: ApiEcosystemFrankencoinInfo;
	fpsInfo: ApiEcosystemFpsInfo;
	minters: ApiMinterListing;
	supply: ApiEcosystemFrankencoinSupply;
	collateralPositions: ApiEcosystemCollateralPositions;
	collateralStats: ApiEcosystemCollateralStats;
}

export async function loadEcosystem(chainId: number): Promise<EcosystemLoad> {
	const chain = contractsFor(chainId);
	const zchf = chain.frankencoin as Address;
	const equity = chain.equity as Address;

	const res = await readContracts(WAGMI_CONFIG, {
		allowFailure: true,
		contracts: [
			{ address: zchf, abi: FrankencoinABI, functionName: "totalSupply" },
			{ address: zchf, abi: FrankencoinABI, functionName: "minterReserve" },
			{ address: zchf, abi: FrankencoinABI, functionName: "equity" },
			{ address: zchf, abi: FrankencoinABI, functionName: "name" },
			{ address: zchf, abi: FrankencoinABI, functionName: "symbol" },
			{ address: zchf, abi: FrankencoinABI, functionName: "decimals" },
			{ address: equity, abi: EquityABI, functionName: "price" },
			{ address: equity, abi: EquityABI, functionName: "totalSupply" },
			{ address: equity, abi: EquityABI, functionName: "name" },
			{ address: equity, abi: EquityABI, functionName: "symbol" },
			{ address: equity, abi: EquityABI, functionName: "decimals" },
		],
	});
	const n = (i: number) => Number(formatUnits((res[i]?.result ?? 0n) as bigint, 18));
	const totalSupply = n(0);
	const minterReserve = n(1);
	const reserveEquity = n(2);
	const fpsPrice = n(6);
	const fpsSupply = n(7);

	const frankencoinInfo = {
		erc20: {
			decimals: Number(res[5]?.result ?? 18),
			name: (res[3]?.result as string) ?? "Frankencoin",
			symbol: (res[4]?.result as string) ?? "ZCHF",
		},
		chains: {} as ApiEcosystemFrankencoinInfo["chains"],
		token: { supply: totalSupply, usd: 0 },
		fps: { price: fpsPrice, totalSupply: fpsSupply, fpsMarketCapInChf: fpsPrice * fpsSupply },
		tvl: { usd: 0, chf: 0 },
	} as unknown as ApiEcosystemFrankencoinInfo;

	const fpsInfo = {
		erc20: {
			decimals: Number(res[10]?.result ?? 18),
			name: (res[8]?.result as string) ?? "Frankencoin Pool Share",
			symbol: (res[9]?.result as string) ?? "FPS",
		},
		chains: {} as ApiEcosystemFpsInfo["chains"],
		reserve: { balance: reserveEquity + minterReserve, equity: reserveEquity, minter: minterReserve },
		token: { marketCap: fpsPrice * fpsSupply, price: fpsPrice, totalSupply: fpsSupply },
		earnings: { profit: 0, loss: 0 },
	} as unknown as ApiEcosystemFpsInfo;

	const minters = await loadMinters(chainId, zchf);

	return {
		frankencoinInfo,
		fpsInfo,
		minters,
		supply: {} as ApiEcosystemFrankencoinSupply,
		collateralPositions: {} as ApiEcosystemCollateralPositions,
		collateralStats: { num: 0, addresses: [], totalValueLocked: { usd: 0, chf: 0 }, map: {} } as ApiEcosystemCollateralStats,
	};
}
