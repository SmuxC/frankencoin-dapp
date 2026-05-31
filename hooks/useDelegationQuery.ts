import { Address } from "viem";

export type PonderDelegationQuery = {
	owner: Address;
	delegatedTo: Address;
};

export type DelegationQuery = {
	owners: {
		[key: Address]: Address;
	};
	delegatees: {
		[key: Address]: Address[];
	};
	allOwners: Address[];
	allDelegatees: Address[];
};

// The full delegation graph needs an indexer (event enumeration), removed in the
// decentralized build. Returns empty — a connected user can still read/set their
// own delegate on-chain via the governance actions.
export const useDelegationQuery = (): DelegationQuery => {
	return {
		owners: {},
		delegatees: {},
		allOwners: [],
		allDelegatees: [],
	};
};
