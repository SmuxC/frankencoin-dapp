import { Address, erc20Abi, getAddress } from "viem";
import { readContracts } from "@wagmi/core";
import type { ApiPriceERC20, ApiPriceERC20Mapping, ApiPriceMapping, ERC20Info, PriceQuery } from "@frankencoin/api";
import { ChainId } from "@frankencoin/zchf";
import { WAGMI_CONFIG } from "../../app.config";
import { loadPositions } from "./positions";
import { contractsFor } from "./contracts";

// ---------------------------------------------------------------------------
// On-chain ERC20 metadata, replacing the /prices/* endpoints.
//
// Fully decentralized = on-chain liqPrice only (no fiat/market prices: the
// protocol is ZCHF-denominated and liquidates by auction, so market price is
// purely informational and is dropped). We still need token metadata
// (name/symbol/decimals) for formatting everywhere — that is all on-chain.
// Price currency fields are left empty.
// ---------------------------------------------------------------------------

async function erc20Info(chainId: number, token: Address): Promise<ERC20Info> {
	const calls = [
		{ address: token, abi: erc20Abi, functionName: "name" },
		{ address: token, abi: erc20Abi, functionName: "symbol" },
		{ address: token, abi: erc20Abi, functionName: "decimals" },
	] as const;
	const [name, symbol, decimals] = await readContracts(WAGMI_CONFIG, { contracts: calls as any, allowFailure: true });
	return {
		chainId: chainId as ChainId,
		address: getAddress(token),
		name: (name?.result as string) ?? "Unknown",
		symbol: (symbol?.result as string) ?? "???",
		decimals: Number(decimals?.result ?? 18),
	};
}

export interface PricesLoad {
	mint: ApiPriceERC20; // ZCHF
	fps: ApiPriceERC20; // Equity / Pool Shares
	collateral: ApiPriceERC20Mapping;
	mapping: ApiPriceMapping;
}

/** On-chain replacement for /prices/* — metadata for ZCHF, FPS and all collateral tokens. */
export async function loadPrices(chainId: number): Promise<PricesLoad> {
	const chain = contractsFor(chainId);
	const zchf = chain.frankencoin as Address;
	const fpsToken = chain.equity as Address;

	// Collateral set is derived from discovered positions (cached after first scan).
	const { list } = await loadPositions(chainId);
	const collateralTokens = [...new Set(list.list.map((p) => p.collateral.toLowerCase()))] as Address[];

	const [mint, fps, ...collaterals] = await Promise.all([
		erc20Info(chainId, zchf),
		erc20Info(chainId, fpsToken),
		...collateralTokens.map((t) => erc20Info(chainId, t)),
	]);

	const collateral: ApiPriceERC20Mapping = {};
	const mapping: ApiPriceMapping = {};
	const now = Math.floor(Date.now() / 1000);
	for (const info of collaterals) {
		collateral[info.address] = info;
		mapping[info.address] = { ...info, timestamp: now, price: {} } as PriceQuery;
	}
	// include ZCHF + FPS in the generic price mapping too
	mapping[mint.address] = { ...mint, timestamp: now, price: {} } as PriceQuery;
	mapping[fps.address] = { ...fps, timestamp: now, price: {} } as PriceQuery;

	return { mint, fps, collateral, mapping };
}
