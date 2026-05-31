import { Address, type AbiEvent, type Log } from "viem";
import { getPublicClient } from "@wagmi/core";
import { WAGMI_CONFIG } from "../../app.config";

// ---------------------------------------------------------------------------
// Generic, cached, incremental event log scanner — the browser-side indexer.
//
// Scans one event on one contract from a deploy block to head, in bounded
// ranges (public RPCs cap `eth_getLogs` spans), adaptively halving on rejection.
// Decoded results are cached in localStorage and only new blocks are scanned on
// subsequent calls. Used for the few discovery lists that have no on-chain
// registry (positions, challenges, minters).
// ---------------------------------------------------------------------------

const MAX_SPAN = 9_000n; // under the common public-RPC 10k getLogs cap

export type ScanProgress = (info: { from: bigint; to: bigint; head: bigint }) => void;

export interface ScanArgs<TEvent extends AbiEvent> {
	chainId: number;
	address: Address;
	event: TEvent;
	fromBlock: bigint;
	cacheKey: string;
	/**
	 * Map a decoded log to the cached record (must be JSON-serializable).
	 * Loosely typed so one factory can be shared across event shapes.
	 */
	decode: (log: Log<bigint, number, false, TEvent, true> & { args: any }) => Record<string, unknown> & { id: string };
	onProgress?: ScanProgress;
}

interface CacheEntry<T> {
	lastBlock: string; // bigint as string
	items: T[];
}

function loadCache<T>(key: string): CacheEntry<T> | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as CacheEntry<T>) : undefined;
	} catch {
		return undefined;
	}
}

function saveCache<T>(key: string, entry: CacheEntry<T>) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(entry));
	} catch {
		// storage full/disabled — scan still works, just uncached.
		// For very large datasets swap this layer for IndexedDB.
	}
}

/**
 * Scan an event and return all deduped records (by `id`), resuming from cache.
 * Records are whatever `decode` returns — JSON-safe objects.
 */
export async function scanEvent<TEvent extends AbiEvent, T extends { id: string }>(args: ScanArgs<TEvent>): Promise<T[]> {
	const client = getPublicClient(WAGMI_CONFIG, { chainId: args.chainId });
	if (!client) throw new Error(`No public client for chain ${args.chainId}`);

	const cached = loadCache<T>(args.cacheKey);
	const head = await client.getBlockNumber();

	const found = new Map<string, T>();
	for (const it of cached?.items ?? []) found.set(it.id, it);

	let from = cached ? BigInt(cached.lastBlock) + 1n : args.fromBlock;
	let span = MAX_SPAN;

	while (from <= head) {
		const to = from + span > head ? head : from + span;
		try {
			const logs = await client.getLogs({ address: args.address, event: args.event, fromBlock: from, toBlock: to });
			for (const log of logs) {
				const rec = args.decode(log as Log<bigint, number, false, TEvent, true>) as T;
				found.set(rec.id, rec);
			}
			args.onProgress?.({ from, to, head });
			from = to + 1n;
			if (span < MAX_SPAN) span = span * 2n > MAX_SPAN ? MAX_SPAN : span * 2n;
		} catch (e) {
			if (span > 1n) {
				span = span / 2n;
				continue;
			}
			throw e;
		}
	}

	const items = [...found.values()];
	saveCache<T>(args.cacheKey, { lastBlock: head.toString(), items });
	return items;
}
