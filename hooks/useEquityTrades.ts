import { Address } from "viem";

export interface EquityTrade {
	count: number;
	created: number;
	txHash: string;
	kind: string;
	amount: bigint;
	shares: bigint;
	price: bigint;
}

// Trade history comes from an indexer (ponder), removed in the decentralized
// build. Returns empty — the equity trades table renders nothing.
export const useEquityTrades = (_address: Address): EquityTrade[] => {
	return [];
};
