"use client";

import Head from "next/head";
import { useState } from "react";
import { Address, erc20Abi, formatUnits, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { readContracts } from "@wagmi/core";
import { useDispatch } from "react-redux";
import { EquityABI } from "@frankencoin/zchf";
import AppCard from "@components/AppCard";
import AppButton from "@components/AppButton";
import AppTitle from "@components/AppTitle";
import { WAGMI_CONFIG } from "../app.config";
import { contractsFor } from "../lib/onchain/contracts";
import { loadPositions } from "../lib/onchain/positions";
import { loadChallenges } from "../lib/onchain/challenges";
import { loadBids } from "../lib/onchain/bids";
import { loadEcosystem } from "../lib/onchain/ecosystem";
import { loadPrices } from "../lib/onchain/erc20meta";
import { loadLeadrate, loadSavings } from "../lib/onchain/savings";
import { setViewAddress } from "../redux/slices/viewer.slice";
import { userRpc, setUserRpc } from "../lib/onchain/rpc";
import { useActiveAccount } from "@hooks";

// ---------------------------------------------------------------------------
// Decentralized health check / view-only test harness.
//
// Runs every on-chain data loader (the API/ponder replacements) for a given
// address and reports pass/fail, item counts, timing and a sample. Confirms the
// dapp works end-to-end with NO backend — just an RPC. Also lets you set the
// address as the global "watch" address to drive the whole app read-only.
// ---------------------------------------------------------------------------

type Check = {
	name: string;
	status: "idle" | "running" | "ok" | "fail";
	ms?: number;
	detail?: string;
	error?: string;
};

const CHAIN = mainnet.id;

export default function OnchainStatus() {
	const dispatch = useDispatch();
	const { address: active } = useActiveAccount();
	const [input, setInput] = useState<string>(active ?? "");
	const [checks, setChecks] = useState<Check[]>([]);
	const [running, setRunning] = useState(false);
	const [rpc, setRpc] = useState<string>(typeof window !== "undefined" ? userRpc(CHAIN) ?? "" : "");

	const addr = isAddress(input) ? (input as Address) : undefined;

	const run = async () => {
		setRunning(true);
		const results: Check[] = [];
		const update = (c: Check) => {
			results.push(c);
			setChecks([...results]);
		};

		const time = async (name: string, fn: () => Promise<string>) => {
			const t0 = performance.now();
			try {
				const detail = await fn();
				update({ name, status: "ok", ms: Math.round(performance.now() - t0), detail });
			} catch (e) {
				update({ name, status: "fail", ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) });
			}
		};

		await time("Positions (PositionOpened scan + hydrate)", async () => {
			const { list } = await loadPositions(CHAIN);
			const open = list.list.filter((p) => !p.closed).length;
			return `${list.num} positions (${open} open)`;
		});

		await time("Challenges (ChallengeStarted scan + state)", async () => {
			const { list } = await loadChallenges(CHAIN);
			const active = list.list.filter((c) => c.status === "Active").length;
			return `${list.num} challenges (${active} active)`;
		});

		await time("Bids (Averted/Succeeded scan)", async () => {
			const { list } = await loadBids(CHAIN);
			return `${list.num} bids`;
		});

		await time("Ecosystem (Frankencoin/Equity + MinterApplied)", async () => {
			const eco = await loadEcosystem(CHAIN);
			return `supply ${Math.round(eco.frankencoinInfo.token.supply).toLocaleString()} ZCHF, FPS ${eco.fpsInfo.token.price.toFixed(
				2
			)}, ${eco.minters.num} minters`;
		});

		await time("Prices (on-chain ERC20 metadata)", async () => {
			const p = await loadPrices(CHAIN);
			return `${Object.keys(p.collateral).length} collateral tokens; ZCHF=${p.mint.symbol}, FPS=${p.fps.symbol}`;
		});

		await time("Leadrate (Savings.currentRatePPM)", async () => {
			const { rate } = await loadLeadrate(CHAIN);
			const mod = contractsFor(CHAIN).savingsV2 as Address;
			const ppm = rate.rate[CHAIN as keyof typeof rate.rate]?.[mod]?.approvedRate ?? 0;
			return `${(ppm / 10000).toFixed(2)}%`;
		});

		if (addr) {
			await time(`Savings balance for ${short(addr)}`, async () => {
				const { info } = await loadSavings(CHAIN, addr);
				return `module total ≈ ${Math.round(info.totalBalance).toLocaleString()} ZCHF`;
			});

			await time(`On-chain balances for ${short(addr)}`, async () => {
				const c = contractsFor(CHAIN);
				const res = await readContracts(WAGMI_CONFIG, {
					allowFailure: true,
					contracts: [
						{ address: c.frankencoin as Address, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
						{ address: c.equity as Address, abi: erc20Abi, functionName: "balanceOf", args: [addr] },
						{ address: c.equity as Address, abi: EquityABI, functionName: "votes", args: [addr] },
					],
				});
				const zchf = formatUnits((res[0]?.result ?? 0n) as bigint, 18);
				const fps = formatUnits((res[1]?.result ?? 0n) as bigint, 18);
				const votes = (res[2]?.result ?? 0n) as bigint;
				return `ZCHF ${(+zchf).toFixed(2)}, FPS ${(+fps).toFixed(2)}, votes ${votes.toString()}`;
			});
		}

		setRunning(false);
	};

	const okCount = checks.filter((c) => c.status === "ok").length;
	const failCount = checks.filter((c) => c.status === "fail").length;

	return (
		<>
			<Head>
				<title>Frankencoin - On-chain Status</title>
			</Head>

			<AppTitle title="Decentralized On-chain Status">
				<div className="text-text-secondary">
					Runs every on-chain data loader (no API, no indexer — just your RPC) and reports pass/fail. Use it to verify the
					decentralized build with any view-only address.
				</div>
			</AppTitle>

			<AppCard>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<input
						className="flex-1 rounded-lg bg-card-content-primary p-3 text-text-primary outline-none"
						placeholder="0x… address to inspect (optional)"
						value={input}
						onChange={(e) => setInput(e.target.value.trim())}
					/>
					<AppButton disabled={running} onClick={run}>
						{running ? "Running…" : "Run all checks"}
					</AppButton>
					<AppButton disabled={!addr} onClick={() => dispatch(setViewAddress(addr))}>
						Watch this address
					</AppButton>
					<AppButton onClick={() => dispatch(setViewAddress(undefined))}>Clear watch</AppButton>
				</div>
				{input.length > 0 && !addr && <div className="text-sm text-text-warning">Not a valid address.</div>}

				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<input
						className="flex-1 rounded-lg bg-card-content-primary p-3 text-text-primary outline-none"
						placeholder="Custom mainnet RPC URL (recommended — your own node avoids public rate limits)"
						value={rpc}
						onChange={(e) => setRpc(e.target.value.trim())}
					/>
					<AppButton
						onClick={() => {
							setUserRpc(CHAIN, rpc.length > 0 ? rpc : null);
							window.location.reload();
						}}
					>
						Save RPC &amp; reload
					</AppButton>
				</div>
				<div className="text-sm text-text-secondary">
					Public RPCs work but rate-limit the first full log scan. A personal RPC (Alchemy, Infura, or your own node) makes it
					fast and reliable. Stored locally only.
				</div>
			</AppCard>

			{checks.length > 0 && (
				<AppCard>
					<div className="flex gap-4 text-sm">
						<span className="text-text-success">{okCount} ok</span>
						<span className={failCount > 0 ? "text-text-warning" : "text-text-secondary"}>{failCount} failed</span>
					</div>
					<div className="flex flex-col divide-y divide-card-content-primary">
						{checks.map((c) => (
							<div key={c.name} className="flex items-start gap-3 py-2">
								<span className="w-6 text-center">{c.status === "ok" ? "✅" : c.status === "fail" ? "❌" : "…"}</span>
								<div className="flex-1">
									<div className="text-text-primary">{c.name}</div>
									<div className="text-sm text-text-secondary">{c.error ?? c.detail}</div>
								</div>
								{c.ms !== undefined && <span className="text-sm text-text-secondary">{c.ms} ms</span>}
							</div>
						))}
					</div>
				</AppCard>
			)}
		</>
	);
}

function short(a: Address): string {
	return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
