import { Address, formatUnits } from "viem";
import { readContracts } from "@wagmi/core";
import { SavingsV2ABI, FrankencoinABI } from "@frankencoin/zchf";
import { ChainId } from "@frankencoin/zchf";
import { contractsFor } from "./contracts";
import type {
	ApiLeadrateInfo,
	ApiLeadrateProposed,
	ApiLeadrateRate,
	ApiSavingsBalance,
	ApiSavingsInfo,
	LeadrateRateQuery,
} from "@frankencoin/api";
import { WAGMI_CONFIG } from "../../app.config";
import { normalizeAddress } from "../../utils/format";

// ---------------------------------------------------------------------------
// On-chain savings + leadrate, replacing /savings/*.
// Core values only (current rate, total balance). Dropped per plan: proposal
// history, rate history, per-account activity, and the ranked leaderboard
// (all need indexed events). Personal balances are read directly in the
// savings interaction card.
// ---------------------------------------------------------------------------

export interface LeadrateLoad {
	info: ApiLeadrateInfo;
	rate: ApiLeadrateRate;
	proposed: ApiLeadrateProposed;
}

export async function loadLeadrate(chainId: number): Promise<LeadrateLoad> {
	const chain = contractsFor(chainId);
	// Governance indexes rate[chainId][module] for BOTH modules (normalized keys):
	// MintModule = savingsV2, SaveModule = savingsReferral. Populate both.
	const mintModule = normalizeAddress(chain.savingsV2 as Address);
	const saveModule = normalizeAddress(chain.savingsReferral as Address);

	const [mintRate, saveRate] = await readContracts(WAGMI_CONFIG, {
		allowFailure: true,
		contracts: [
			{ address: chain.savingsV2 as Address, abi: SavingsV2ABI, functionName: "currentRatePPM" },
			{ address: chain.savingsReferral as Address, abi: SavingsV2ABI, functionName: "currentRatePPM" },
		],
	});

	const mk = (module: Address, approvedRate: number): LeadrateRateQuery => ({
		chainId: chainId as ChainId,
		created: Math.floor(Date.now() / 1000),
		count: 0,
		blockheight: 0,
		module,
		approvedRate,
		txHash: "",
	});
	const mintQuery = mk(mintModule, Number(mintRate?.result ?? 0));
	const saveQuery = mk(saveModule, Number(saveRate?.result ?? 0));

	// Mapped types are keyed by every ChainId — fill mainnet only and cast.
	const rate = {
		rate: { [chainId]: { [mintModule]: mintQuery, [saveModule]: saveQuery } } as unknown as ApiLeadrateRate["rate"],
		list: { [chainId]: { [mintModule]: [mintQuery], [saveModule]: [saveQuery] } } as unknown as ApiLeadrateRate["list"],
	};

	const info = {
		rate: rate.rate,
		proposed: {} as ApiLeadrateInfo["proposed"],
		open: {} as ApiLeadrateInfo["open"],
	};
	const proposed = {
		proposed: {} as ApiLeadrateProposed["proposed"],
		list: {} as ApiLeadrateProposed["list"],
	};

	return { info, rate, proposed };
}

export interface SavingsLoad {
	info: ApiSavingsInfo;
	balance: ApiSavingsBalance;
}

export async function loadSavings(chainId: number, _account?: Address): Promise<SavingsLoad> {
	const chain = contractsFor(chainId);
	const zchf = chain.frankencoin as Address;
	// The savings module the UI reads/writes is the referral savings contract.
	// The status map is keyed by chainId then normalized module address — exactly
	// how SavingsInteractionCard/SavingsGlobalCard/savings.tsx index it.
	const moduleAddr = chain.savingsReferral as Address;
	const moduleKey = normalizeAddress(moduleAddr);

	const [rateRes, balRes] = await readContracts(WAGMI_CONFIG, {
		allowFailure: true,
		contracts: [
			{ address: moduleAddr, abi: SavingsV2ABI, functionName: "currentRatePPM" },
			{ address: zchf, abi: FrankencoinABI, functionName: "balanceOf", args: [moduleAddr] },
		],
	});
	const rate = Number(rateRes?.result ?? 0);
	const balance = (balRes?.result ?? 0n) as bigint;
	const totalBalance = Number(formatUnits(balance, 18));

	const statusItem = {
		chainId: chainId as ChainId,
		updated: Math.floor(Date.now() / 1000),
		module: moduleKey,
		balance: balance.toString(),
		interest: "0",
		save: "0",
		withdraw: "0",
		rate,
		counterInterest: 0,
		counterRateChanged: 0,
		counterRateProposed: 0,
		counterSave: 0,
		counterWithdraw: 0,
	};
	const status = { [chainId]: { [moduleKey]: statusItem } } as unknown as ApiSavingsInfo["status"];

	const info: ApiSavingsInfo = { status, totalBalance, ratioOfSupply: 0, totalInterest: 0 };
	return { info, balance: {} as ApiSavingsBalance };
}
