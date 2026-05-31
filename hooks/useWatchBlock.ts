import { useEffect, useState } from "react";
import { useBlockNumber } from "wagmi";

// Shared block watcher used to drive passive contract re-reads.
//
// Plain `useBlockNumber({ watch: true })` makes every dependent component refetch
// its multicalls on EVERY new block (~12s). That read storm — multiplied by users
// and mounted components — is the main metered-RPC cost.
//
// This hook only advances the returned block number once `every` blocks have
// passed, so dependent `useEffect`s fire far less often. The first value is
// emitted immediately so initial loads are unaffected.
export function useWatchBlock(opts?: { chainId?: number; every?: number }): bigint | undefined {
	const { chainId, every = 5 } = opts ?? {};
	const { data } = useBlockNumber({ chainId, watch: true });
	const [block, setBlock] = useState<bigint | undefined>(undefined);

	useEffect(() => {
		if (data === undefined) return;
		setBlock((prev) => {
			if (prev === undefined) return data; // emit first block right away
			return data >= prev + BigInt(every) ? data : prev;
		});
	}, [data, every]);

	return block;
}
