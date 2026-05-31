import { fallback, http, type Transport } from "viem";
import { mainnet, polygon, optimism, arbitrum, base, avalanche, gnosis, sonic } from "@reown/appkit/networks";

// ---------------------------------------------------------------------------
// RPC sovereignty: the dapp is fully decentralized — it never depends on a
// metered/hardcoded provider key. Reads go to public RPCs by default, and the
// user can supply their own node (ideally a local one) which takes priority.
//
// User override is read from localStorage `fc:rpc:<chainId>` at module load.
// Changing it requires a page reload (wagmi config is built once) — acceptable
// for a self-hosted, sovereign setup.
// ---------------------------------------------------------------------------

export const RPC_STORAGE_PREFIX = "fc:rpc:";

// Public, keyless RPC endpoints. Multiple per chain so `fallback` can rotate on
// failure. IMPORTANT: these must send permissive CORS headers — the dapp calls
// them directly from the browser. Endpoints that block CORS (e.g. llamarpc) or
// hard rate-limit (publicnode) are avoided / demoted. For heavy use (the first
// log scan) users should set their own RPC — see userRpc/localStorage.
const PUBLIC_RPCS: Record<number, string[]> = {
	[mainnet.id]: [
		"https://eth.merkle.io",
		"https://rpc.ankr.com/eth",
		"https://eth.drpc.org",
		"https://1rpc.io/eth",
		"https://cloudflare-eth.com",
		"https://ethereum-rpc.publicnode.com",
	],
	[polygon.id]: ["https://polygon.drpc.org", "https://polygon-rpc.com", "https://rpc.ankr.com/polygon"],
	[optimism.id]: ["https://optimism.drpc.org", "https://mainnet.optimism.io", "https://rpc.ankr.com/optimism"],
	[arbitrum.id]: ["https://arbitrum.drpc.org", "https://arb1.arbitrum.io/rpc", "https://rpc.ankr.com/arbitrum"],
	[base.id]: ["https://base.drpc.org", "https://mainnet.base.org", "https://rpc.ankr.com/base"],
	[avalanche.id]: ["https://avalanche.drpc.org", "https://api.avax.network/ext/bc/C/rpc"],
	[gnosis.id]: ["https://gnosis.drpc.org", "https://rpc.gnosischain.com"],
	[sonic.id]: ["https://sonic.drpc.org", "https://rpc.soniclabs.com"],
};

/** Read a user-supplied RPC override for a chain (client-side only). */
export function userRpc(chainId: number): string | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		const v = window.localStorage.getItem(`${RPC_STORAGE_PREFIX}${chainId}`);
		return v && v.trim().length > 0 ? v.trim() : undefined;
	} catch {
		return undefined;
	}
}

/** Persist (or clear) a user RPC override. Caller should reload afterwards. */
export function setUserRpc(chainId: number, url: string | null) {
	if (typeof window === "undefined") return;
	try {
		const key = `${RPC_STORAGE_PREFIX}${chainId}`;
		if (url && url.trim().length > 0) window.localStorage.setItem(key, url.trim());
		else window.localStorage.removeItem(key);
	} catch {
		/* storage disabled */
	}
}

/** All RPC URLs for a chain: user override first, then public endpoints. */
export function rpcUrls(chainId: number): string[] {
	const user = userRpc(chainId);
	const pub = PUBLIC_RPCS[chainId] ?? [];
	return user ? [user, ...pub] : pub;
}

/** Build a viem transport for a chain (user RPC prioritized, public as fallback). */
export function transportFor(chainId: number): Transport {
	const urls = rpcUrls(chainId);
	if (urls.length === 0) return http(); // viem default public RPC for the chain
	return fallback(urls.map((u) => http(u)));
}
