import { Address } from "viem";

export interface FPSBalanceHistory {
	count: number;
	created: number;
	txHash: string;
	from: Address;
	to: Address;
	amount: bigint;
	balanceFrom: bigint;
	balanceTo: bigint;
}

// Historical balances come from an indexer (ponder), removed in the decentralized
// build. Returns empty — the balance-history chart renders nothing.
export const useFPSBalanceHistory = (_address: Address): FPSBalanceHistory[] => {
	return [];
};
