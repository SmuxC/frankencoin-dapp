import { createSlice, Dispatch } from "@reduxjs/toolkit";
import {
	PricesState,
	DispatchBoolean,
	DispatchApiPriceMapping,
	DispatchApiPriceERC20Mapping,
	DispatchApiPriceMarketChart,
} from "./prices.types";
import { ApiPriceERC20, ApiPriceERC20Mapping, ApiPriceMapping, ApiPriceMarketChart } from "@frankencoin/api";
import { CONFIG } from "../../app.config";
import { mainnet } from "viem/chains";
import { loadPrices } from "../../lib/onchain/erc20meta";
import { showErrorToast } from "@utils";
import { zeroAddress } from "viem";
import { ChainId } from "@frankencoin/zchf";

// --------------------------------------------------------------------------------

export const initialState: PricesState = {
	error: null,
	loaded: false,

	coingecko: {},
	mint: {
		chainId: 1 as ChainId,
		address: zeroAddress,
		name: "Frankencoin",
		symbol: "ZCHF",
		decimals: 18,
	},
	fps: {
		chainId: 1 as ChainId,
		address: zeroAddress,
		name: "Frankencoin Pool Share",
		symbol: "FPS",
		decimals: 18,
	},
	collateral: {},
	marketChart: { prices: [], market_caps: [], total_volumes: [] },
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "prices",
	initialState,
	reducers: {
		// HAS ERROR
		hasError(state, action: { payload: string }) {
			state.error = action.payload;
		},

		// SET LOADED
		setLoaded: (state, action: { payload: boolean }) => {
			state.loaded = action.payload;
		},

		// -------------------------------------
		// SET COINGECKO PRICE LIST
		setListMapping: (state, action: { payload: ApiPriceMapping }) => {
			state.coingecko = { ...state.coingecko, ...action.payload };
		},

		// -------------------------------------
		// SET MINT ERC20Info
		setMintERC20Info: (state, action: { payload: ApiPriceERC20 }) => {
			state.mint = action.payload;
		},

		// -------------------------------------
		// SET FPS ERC20Info
		setFpsERC20Info: (state, action: { payload: ApiPriceERC20 }) => {
			state.fps = action.payload;
		},

		// SET COLLATERAL ERC20Info
		setCollateralERC20Info: (state, action: { payload: ApiPriceERC20Mapping }) => {
			state.collateral = action.payload;
		},

		// -------------------------------------
		// SET Market Chart
		setMarketChart: (state, action: { payload: ApiPriceMarketChart }) => {
			state.marketChart = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchPricesList =
	() => async (dispatch: Dispatch<DispatchBoolean | DispatchApiPriceMapping | DispatchApiPriceERC20Mapping>) => {
		// ---------------------------------------------------------------
		CONFIG.verbose && console.log("Loading [REDUX]: PricesList");

		try {
			// ---------------------------------------------------------------
			// On-chain ERC20 metadata only. Market/fiat prices are dropped — the
			// protocol is ZCHF-denominated and liquidates by auction (no oracle).
			const { mint, fps, collateral, mapping } = await loadPrices(mainnet.id);
			dispatch(slice.actions.setListMapping(mapping));
			dispatch(slice.actions.setMintERC20Info(mint));
			dispatch(slice.actions.setCollateralERC20Info(collateral));
			dispatch(slice.actions.setFpsERC20Info(fps));

			// ---------------------------------------------------------------
			// Finalizing, loaded set to true
			dispatch(slice.actions.setLoaded(true));
		} catch (error) {
			// ---------------------------------------------------------------
			// Error, show toast message
			showErrorToast({ message: "Fetching PricesList", error });
		}
	};

// --------------------------------------------------------------------------------
// Market chart history is dropped (needs an indexer). Kept as a no-op so callers
// (if any remain) don't break.
export const fetchMarketChart = () => async (_dispatch: Dispatch<DispatchApiPriceMarketChart>) => {
	return;
};
