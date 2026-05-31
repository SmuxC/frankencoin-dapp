import { useEffect, useState } from "react";
import { getPublicClient } from "@wagmi/core";
import { mainnet } from "viem/chains";
import { WAGMI_CONFIG } from "../app.config";
import { Loading } from "../components/LoadingScreen";

// Decentralized build: no API/indexer to ping. The only dependency is an RPC.
// We check mainnet RPC reachability (the user's own node or a public fallback).
export function useServiceStatus(): Loading[] {
	const [rpcStatus, setRpcStatus] = useState(false);

	useEffect(() => {
		const client = getPublicClient(WAGMI_CONFIG, { chainId: mainnet.id });
		if (!client) {
			setRpcStatus(false);
			return;
		}
		client
			.getBlockNumber()
			.then((b) => setRpcStatus(b > 0n))
			.catch(() => setRpcStatus(false));
	}, []);

	return [{ id: "rpc", title: "RPC", isLoaded: rpcStatus }];
}
