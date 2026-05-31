import { createSlice, Dispatch } from "@reduxjs/toolkit";
import {
	ApiChallengesChallengers,
	ApiChallengesListing,
	ApiChallengesMapping,
	ApiChallengesPositions,
	ApiChallengesPrices,
} from "@frankencoin/api";
import { CONFIG } from "../../app.config";
import { mainnet } from "viem/chains";
import { loadChallenges } from "../../lib/onchain/challenges";
import { showErrorToast } from "@utils";
import {
	ChallengesState,
	DispatchApiChallengesChallengers,
	DispatchApiChallengesListing,
	DispatchApiChallengesMapping,
	DispatchApiChallengesPositions,
	DispatchApiChallengesPrices,
	DispatchBoolean,
} from "./challenges.types";

// --------------------------------------------------------------------------------

export const initialState: ChallengesState = {
	error: null,
	loaded: false,

	list: { num: 0, list: [] },

	mapping: { num: 0, challenges: [], map: {} },
	challengers: { num: 0, challengers: [], map: {} },
	positions: { num: 0, positions: [], map: {} },
	challengesPrices: { num: 0, ids: [], map: {} },
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "challenges",
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
		// SET LIST
		setList: (state, action: { payload: ApiChallengesListing }) => {
			state.list = action.payload;
		},

		// -------------------------------------
		// SET MAPPING
		setMapping: (state, action: { payload: ApiChallengesMapping }) => {
			state.mapping = action.payload;
		},

		// -------------------------------------
		// SET Challengers
		setChallengers: (state, action: { payload: ApiChallengesChallengers }) => {
			state.challengers = action.payload;
		},

		// SET Positions
		setPositions: (state, action: { payload: ApiChallengesPositions }) => {
			state.positions = action.payload;
		},

		// SET Prices
		setPrices: (state, action: { payload: ApiChallengesPrices }) => {
			state.challengesPrices = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchChallengesList =
	() =>
	async (
		dispatch: Dispatch<
			| DispatchBoolean
			| DispatchApiChallengesListing
			| DispatchApiChallengesMapping
			| DispatchApiChallengesChallengers
			| DispatchApiChallengesPositions
			| DispatchApiChallengesPrices
		>
	) => {
		// ---------------------------------------------------------------
		CONFIG.verbose && console.log("Loading [REDUX]: ChallengesList");

		try {
			// ---------------------------------------------------------------
			// Read challenges directly from chain (ChallengeStarted scan + current state)
			const { list, mapping, challengers, positions, prices } = await loadChallenges(mainnet.id);
			dispatch(slice.actions.setList(list));
			dispatch(slice.actions.setMapping(mapping));
			dispatch(slice.actions.setChallengers(challengers));
			dispatch(slice.actions.setPositions(positions));
			dispatch(slice.actions.setPrices(prices));

			// ---------------------------------------------------------------
			// Finalizing, loaded set to true
			dispatch(slice.actions.setLoaded(true));
		} catch (error) {
			// ---------------------------------------------------------------
			// Error, show toast message
			showErrorToast({ message: "Fetching ChallengesList", error });
		}
	};
