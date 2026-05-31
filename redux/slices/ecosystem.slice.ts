import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { CONFIG } from "../../app.config";
import { mainnet } from "viem/chains";
import { loadEcosystem } from "../../lib/onchain/ecosystem";
import { showErrorToast } from "@utils";
import {
	DispatchApiEcosystemCollateralPositions,
	DispatchApiEcosystemCollateralStats,
	DispatchApiEcosystemFpsInfo,
	DispatchApiEcosystemFrankencoinInfo,
	DispatchApiEcosystemFrankencoinMinters,
	DispatchApiEcosystemFrankencoinSupply,
	DispatchBoolean,
	EcosystemState,
} from "./ecosystem.types";
import {
	ApiEcosystemCollateralPositions,
	ApiEcosystemCollateralStats,
	ApiEcosystemFpsInfo,
	ApiEcosystemFrankencoinInfo,
	ApiEcosystemFrankencoinSupply,
	ApiMinterListing,
} from "@frankencoin/api";

// --------------------------------------------------------------------------------

export const initialState: EcosystemState = {
	error: null,
	loaded: false,

	collateralPositions: {},
	collateralStats: { num: 0, addresses: [], totalValueLocked: { usd: 0, chf: 0 }, map: {} },
	fpsInfo: {
		erc20: { decimals: 0, name: "", symbol: "" },
		chains: {} as ApiEcosystemFpsInfo["chains"],
		reserve: { balance: 0, equity: 0, minter: 0 },
		token: { marketCap: 0, price: 0, totalSupply: 0 },
		earnings: { profit: 0, loss: 0 },
	},
	frankencoinInfo: {
		erc20: { decimals: 0, name: "", symbol: "" },
		chains: {} as ApiEcosystemFrankencoinInfo["chains"],
		token: { supply: 0, usd: 0 },
		fps: {
			price: 0,
			totalSupply: 0,
			marketCap: 0,
		},
		tvl: { usd: 0, chf: 0 },
	},
	frankencoinMinters: { num: 0, list: [] },
	frankencoinSupply: {} as ApiEcosystemFrankencoinSupply,
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "ecosystem",
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
		// SET Collateral Positions
		setCollateralPositions: (state, action: { payload: ApiEcosystemCollateralPositions }) => {
			state.collateralPositions = action.payload;
		},

		// SET Collateral Stats
		setCollateralStats: (state, action: { payload: ApiEcosystemCollateralStats }) => {
			state.collateralStats = action.payload;
		},

		// SET Fps Info
		setFpsInfo: (state, action: { payload: ApiEcosystemFpsInfo }) => {
			state.fpsInfo = action.payload;
		},

		// SET Frankencoin Info
		setFrankencoinInfo: (state, action: { payload: ApiEcosystemFrankencoinInfo }) => {
			state.frankencoinInfo = action.payload;
		},

		// SET Frankencoin Minters
		setFrankencoinMinters: (state, action: { payload: ApiMinterListing }) => {
			state.frankencoinMinters = action.payload;
		},

		// SET Frankencoin Supply
		setFrankencoinSupply: (state, action: { payload: ApiEcosystemFrankencoinSupply }) => {
			state.frankencoinSupply = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchEcosystem =
	() =>
	async (
		dispatch: Dispatch<
			| DispatchBoolean
			| DispatchApiEcosystemCollateralPositions
			| DispatchApiEcosystemCollateralStats
			| DispatchApiEcosystemFpsInfo
			| DispatchApiEcosystemFrankencoinInfo
			| DispatchApiEcosystemFrankencoinMinters
			| DispatchApiEcosystemFrankencoinSupply
		>
	) => {
		// ---------------------------------------------------------------
		CONFIG.verbose && console.log("Loading [REDUX]: Ecosystem");

		try {
			// ---------------------------------------------------------------
			// Read ecosystem stats directly from chain (Frankencoin/Equity reads +
			// MinterApplied scan). Collateral TVL needs market prices (dropped).
			const { frankencoinInfo, fpsInfo, minters, supply, collateralPositions, collateralStats } = await loadEcosystem(mainnet.id);
			dispatch(slice.actions.setCollateralPositions(collateralPositions));
			dispatch(slice.actions.setCollateralStats(collateralStats));
			dispatch(slice.actions.setFpsInfo(fpsInfo));
			dispatch(slice.actions.setFrankencoinInfo(frankencoinInfo));
			dispatch(slice.actions.setFrankencoinMinters(minters));
			dispatch(slice.actions.setFrankencoinSupply(supply));

			// ---------------------------------------------------------------
			// Finalizing, loaded set to true
			dispatch(slice.actions.setLoaded(true));
		} catch (error) {
			// ---------------------------------------------------------------
			// Error, show toast message
			showErrorToast({ message: "Fetching Ecosystem", error });
		}
	};
