import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { DispatchBoolean, DispatchMarketArray, Market, MorphoState } from "./morpho.types";

// --------------------------------------------------------------------------------

export const initialState: MorphoState = {
	error: null,
	loading: false,

	markets: [],
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "morpho",
	initialState,
	reducers: {
		// RESET
		resetState(state) {
			state = initialState;
		},

		// HAS ERROR
		hasError(state, action: { payload: string }) {
			state.error = action.payload;
		},

		// SET LOADING
		setLoading: (state, action: { payload: boolean }) => {
			state.loading = action.payload;
		},

		// -------------------------------------
		// SET MARKETS
		setMarkets: (state, action: { payload: Market[] }) => {
			state.markets = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
// Morpho markets come from Morpho's third-party GraphQL API. Dropped in the
// decentralized build (no external API). No-op so the borrow Morpho table is empty.
export const fetchMorphoMarkets = () => async (dispatch: Dispatch<DispatchBoolean | DispatchMarketArray>) => {
	dispatch(slice.actions.setMarkets([]));
	dispatch(slice.actions.setLoading(false));
};
