import { Address } from "viem";

export interface FPSEarningsHistory {
	id: string;
	count: number;
	created: number;
	kind: string;
	amount: bigint;
	perFPS: bigint;
}

// Historical FPS earnings come from an indexer (ponder), which is removed in the
// decentralized build. Returns empty — the earnings chart renders nothing.
export const useFPSEarningsHistory = (_address: Address): FPSEarningsHistory[] => {
	return [];
};
