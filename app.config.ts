"use client";

import { cookieStorage, createStorage } from "@wagmi/core";
import { injected, coinbaseWallet, safe } from "@wagmi/connectors";
import { mainnet, polygon, arbitrum, optimism, avalanche, gnosis, sonic, base } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { Address } from "viem";
import { normalizeAddress } from "./utils/format";
import { SupportedChains } from "@frankencoin/zchf";
import { transportFor } from "./lib/onchain/rpc";

export type ConfigEnv = {
	verbose: boolean;
	landing: string;
	app: string;
	wagmiId: string;
};

// Fully decentralized: no API, no indexer, no metered RPC key. All protocol
// data is read directly from chain via user-configurable RPCs (see lib/onchain/rpc.ts).
export const CONFIG: ConfigEnv = {
	verbose: false,

	landing: process.env.NEXT_PUBLIC_LANDINGPAGE_URL || "https://frankencoin.com",
	app: process.env.NEXT_PUBLIC_APP_URL || "https://app.frankencoin.com",
	wagmiId: process.env.NEXT_PUBLIC_WAGMI_ID || "3321ad5a4f22083fe6fe82208a4c9ddc",
};

// WAGMI CONFIG
export const WAGMI_CHAIN = SupportedChains["mainnet"];
export const WAGMI_CHAINS = Object.values(SupportedChains);
export const WAGMI_METADATA = {
	name: "Frankencoin",
	description: "Frankencoin Frontend Application",
	url: CONFIG.app,
	icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const WAGMI_ADAPTER = new WagmiAdapter({
	networks: WAGMI_CHAINS,
	// Poll new blocks at mainnet block time (~12s) instead of the wagmi default 4s.
	pollingInterval: 12_000,
	// Keyless, user-configurable transports — public RPC by default, own node optional.
	transports: {
		[mainnet.id]: transportFor(mainnet.id),
		[polygon.id]: transportFor(polygon.id),
		[optimism.id]: transportFor(optimism.id),
		[arbitrum.id]: transportFor(arbitrum.id),
		[base.id]: transportFor(base.id),
		[avalanche.id]: transportFor(avalanche.id),
		[gnosis.id]: transportFor(gnosis.id),
		[sonic.id]: transportFor(sonic.id),
	},
	batch: {
		multicall: {
			wait: 200,
		},
	},
	connectors: [
		safe({
			allowedDomains: [/gnosis-safe.io$/, /app.safe.global$/, /dhedge.org$/],
		}),
		injected({ shimDisconnect: true }),
		coinbaseWallet({
			appName: WAGMI_METADATA.name,
			appLogoUrl: WAGMI_METADATA.icons[0],
		}),
	],
	ssr: true,
	storage: createStorage({
		storage: cookieStorage,
	}),
	projectId: CONFIG.wagmiId,
});

export const WAGMI_CONFIG = WAGMI_ADAPTER.wagmiConfig;

// MINT POSITION BLACKLIST
export const MINT_POSITION_BLACKLIST: Address[] = [
	"0x98725eE62833096C1c9bE26001F3cDA9a6241EF3",
	"0x7FF29064edc935571f89266607eAA0b5a51b795d",
];
export const POSITION_BLACKLISTED = (addr: Address): boolean => {
	return MINT_POSITION_BLACKLIST.some((p) => normalizeAddress(p) === normalizeAddress(addr));
};
