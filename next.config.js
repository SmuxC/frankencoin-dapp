/** @type {import('next').NextConfig} */

const nextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@frankencoin/zchf", "@frankencoin/api"],

	// IPFS static hosting: emit a fully static site to ./out
	output: "export",
	trailingSlash: true,
	images: { unoptimized: true },

	webpack: (config) => {
		// Stub out optional peer deps not used in this app
		config.resolve.alias = {
			...config.resolve.alias,
			"pino-pretty": false,
			lokijs: false,
			encoding: false,
			"@metamask/connect-evm": false,
			porto: false,
			"@base-org/account": false,
			accounts: false,
		};
		return config;
	},

	// @dev: if you want to set the iFrame SAMEORIGIN headers,
	// to prevent injecting in cross domains.
	// headers: [
	// 	{
	// 		key: "X-Frame-Options",
	// 		value: "SAMEORIGIN",
	// 	},
	// ],

	// @dev: `headers` removed — not supported with output: "export" (static IPFS build).
	// Set these via the IPFS gateway / reverse proxy instead if needed.
};

module.exports = nextConfig;
