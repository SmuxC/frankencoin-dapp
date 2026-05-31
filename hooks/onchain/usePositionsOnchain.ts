import { useCallback, useEffect, useState } from "react";
import { Address } from "viem";
import type { PositionQuery } from "@frankencoin/api";
import { loadPositions } from "../../lib/onchain/positions";

// On-chain positions for components/pages. Wraps the shared loader (lib/onchain/positions)
// and optionally filters to one owner ("my positions"). No API/ponder.

interface State {
	positions: PositionQuery[];
	loading: boolean;
	error: string | null;
	progress: number; // 0..1 scan coverage
}

export function usePositionsOnchain(opts?: { chainId?: number; owner?: Address }) {
	const chainId = opts?.chainId ?? 1;
	const owner = opts?.owner?.toLowerCase();
	const [state, setState] = useState<State>({ positions: [], loading: true, error: null, progress: 0 });

	const run = useCallback(async () => {
		setState((s) => ({ ...s, loading: true, error: null }));
		try {
			const { list } = await loadPositions(chainId, ({ to, head }) =>
				setState((s) => ({ ...s, progress: head > 0n ? Math.min(Number(to) / Number(head), 1) : 1 }))
			);
			const positions = owner ? list.list.filter((p) => p.owner.toLowerCase() === owner) : list.list;
			setState({ positions, loading: false, error: null, progress: 1 });
		} catch (e) {
			setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
		}
	}, [chainId, owner]);

	useEffect(() => {
		void run();
	}, [run]);

	return { ...state, rescan: run };
}
