import { Address } from "viem";

export interface FPSHolder {
	account: Address;
	balance: bigint;
	updated: number;
}

// The FPS holder ranking needs an indexer (token balance enumeration), which is
// removed in the decentralized build. Returns empty — voting power for the
// connected wallet and known delegation addresses is still read on-chain.
export const useFPSHolders = (): {
	loading: boolean;
	holders: FPSHolder[];
} => {
	return { loading: false, holders: [] };
};
