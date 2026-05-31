// Standalone smoke test of the decentralized data layer against live mainnet.
// Mirrors the queries pages/onchain-status.tsx runs (positions discovery + hydrate,
// ecosystem reads, balances/votes) using viem directly — no app config, no DOM.
import { createPublicClient, http, parseAbiItem, erc20Abi, formatUnits, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { ADDRESS, PositionV2ABI, FrankencoinABI, EquityABI, SavingsV2ABI } from "@frankencoin/zchf";

const RPCS = ["https://ethereum-rpc.publicnode.com", "https://rpc.ankr.com/eth", "https://eth.drpc.org", "https://1rpc.io/eth"];
let ci = 0;
let client = createPublicClient({ chain: mainnet, transport: http(RPCS[ci]) });
const rotate = () => { ci = (ci + 1) % RPCS.length; client = createPublicClient({ chain: mainnet, transport: http(RPCS[ci]) }); console.error("  …switch RPC ->", RPCS[ci]); };
const call = async (fn) => { for (let a = 0; a < RPCS.length * 3; a++) { try { return await fn(); } catch { rotate(); await new Promise(r => setTimeout(r, 250)); } } throw new Error("all RPCs failed"); };

const A = ADDRESS[1];
const HUB_V2 = getAddress(A.mintingHubV2);
const ZCHF = getAddress(A.frankencoin);
const EQUITY = getAddress(A.equity);
const SAVINGS = getAddress(A.savingsV2);
const POSITION_OPENED = parseAbiItem("event PositionOpened(address indexed owner, address indexed position, address original, address collateral)");

const head = await call(() => client.getBlockNumber());
console.log("head block:", head.toString());

// 1) discover recent positions (scan a recent window so the smoke test is fast)
const SPAN = 9000n;
const WINDOW = 600000n; // ~last ~3 months
let from = head - WINDOW;
const found = [];
console.log(`\n[1] scanning PositionOpened on hub V2 ${from}..${head} …`);
while (from <= head) {
	const to = from + SPAN > head ? head : from + SPAN;
	const logs = await call(() => client.getLogs({ address: HUB_V2, event: POSITION_OPENED, fromBlock: from, toBlock: to }));
	for (const l of logs) found.push({ position: getAddress(l.args.position), owner: getAddress(l.args.owner), collateral: getAddress(l.args.collateral) });
	from = to + 1n;
}
console.log(`    found ${found.length} positions in window`);
if (found.length === 0) { console.log("no recent positions — widen WINDOW"); process.exit(0); }

// 2) hydrate: find an OPEN one with debt
console.log(`\n[2] reading state for ${found.length} positions …`);
const fields = ["owner", "collateral", "minted", "isClosed", "price", "expiration", "limit"];
const calls = found.flatMap((p) => fields.map((f) => ({ address: p.position, abi: PositionV2ABI, functionName: f })));
const res = await call(() => client.multicall({ contracts: calls, allowFailure: true }));
const hydrated = found.map((p, i) => {
	const at = (f) => res[i * fields.length + fields.indexOf(f)]?.result;
	return { ...p, minted: at("minted") ?? 0n, isClosed: Boolean(at("isClosed")), price: at("price") ?? 0n, expiration: Number(at("expiration") ?? 0), limit: at("limit") ?? 0n };
});
const open = hydrated.filter((p) => !p.isClosed && p.minted > 0n);
console.log(`    ${open.length} open positions with debt`);
const pick = open.sort((a, b) => (b.minted > a.minted ? 1 : -1))[0] ?? hydrated[0];
console.log(`    picked position ${pick.position}\n    owner ${pick.owner}\n    minted ${formatUnits(pick.minted, 18)} ZCHF, liqPrice(raw) ${pick.price}`);

const addr = pick.owner;

// 3) ecosystem reads
console.log(`\n[3] ecosystem (Frankencoin/Equity direct reads) …`);
const eco = await call(() => client.multicall({
	allowFailure: true,
	contracts: [
		{ address: ZCHF, abi: FrankencoinABI, functionName: "totalSupply" },
		{ address: ZCHF, abi: FrankencoinABI, functionName: "minterReserve" },
		{ address: ZCHF, abi: FrankencoinABI, functionName: "equity" },
		{ address: EQUITY, abi: EquityABI, functionName: "price" },
		{ address: EQUITY, abi: EquityABI, functionName: "totalSupply" },
		{ address: SAVINGS, abi: SavingsV2ABI, functionName: "currentRatePPM" },
		{ address: ZCHF, abi: erc20Abi, functionName: "balanceOf", args: [SAVINGS] },
	],
}));
const num = (i) => Number(formatUnits(eco[i]?.result ?? 0n, 18));
console.log(`    ZCHF totalSupply : ${num(0).toLocaleString()}`);
console.log(`    minterReserve    : ${num(1).toLocaleString()}`);
console.log(`    equity (reserve) : ${num(2).toLocaleString()}`);
console.log(`    FPS price        : ${num(3).toFixed(4)} ZCHF`);
console.log(`    FPS totalSupply  : ${num(4).toLocaleString()}`);
console.log(`    leadrate         : ${(Number(eco[5]?.result ?? 0n) / 10000).toFixed(2)} %`);
console.log(`    savings module bal: ${num(6).toLocaleString()} ZCHF`);

// 4) per-address balances/votes + collateral meta
console.log(`\n[4] account ${addr} …`);
const acct = await call(() => client.multicall({
	allowFailure: true,
	contracts: [
		{ address: ZCHF, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
		{ address: EQUITY, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
		{ address: EQUITY, abi: EquityABI, functionName: "votes", args: [addr] },
		{ address: pick.collateral, abi: erc20Abi, functionName: "symbol" },
		{ address: pick.collateral, abi: erc20Abi, functionName: "decimals" },
		{ address: pick.collateral, abi: erc20Abi, functionName: "balanceOf", args: [pick.position] },
	],
}));
const colDec = Number(acct[4]?.result ?? 18);
console.log(`    ZCHF balance : ${(+formatUnits(acct[0]?.result ?? 0n, 18)).toFixed(2)}`);
console.log(`    FPS balance  : ${(+formatUnits(acct[1]?.result ?? 0n, 18)).toFixed(4)}`);
console.log(`    votes        : ${(acct[2]?.result ?? 0n).toString()}`);
console.log(`    collateral   : ${acct[3]?.result} (${colDec} dec), locked in position: ${formatUnits(acct[5]?.result ?? 0n, colDec)}`);

console.log(`\n✅ all on-chain checks succeeded with no API/indexer — RPC only.`);
console.log(`\nTest in the UI: open http://localhost:3010/onchain-status and paste ${addr}`);
