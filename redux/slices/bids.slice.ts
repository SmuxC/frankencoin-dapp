import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { CONFIG } from "../../app.config";
import { mainnet } from "viem/chains";
import { loadBids } from "../../lib/onchain/bids";
import { showErrorToast } from "@utils";
import {
	BidsState,
	DispatchBoolean,
	DispatchApiBidsListing,
	DispatchApiBidsBidders,
	DispatchApiBidsChallenges,
	DispatchApiBidsPositions,
	DispatchApiBidsMapping,
} from "./bids.types";
import { ApiBidsBidders, ApiBidsChallenges, ApiBidsListing, ApiBidsMapping, ApiBidsPositions } from "@frankencoin/api";

// --------------------------------------------------------------------------------

export const initialState: BidsState = {
	error: null,
	loaded: false,

	list: { num: 0, list: [] },

	mapping: { num: 0, bidIds: [], map: {} },
	bidders: { num: 0, bidders: [], map: {} },
	challenges: { num: 0, challenges: [], map: {} },
	positions: { num: 0, positions: [], map: {} },
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "bids",
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
		// SET Bids LIST
		setList: (state, action: { payload: ApiBidsListing }) => {
			state.list = action.payload;
		},

		// -------------------------------------
		// SET Bids mapping
		setMapping: (state, action: { payload: ApiBidsMapping }) => {
			state.mapping = action.payload;
		},

		// -------------------------------------
		// SET Bids Bidders
		setBidders: (state, action: { payload: ApiBidsBidders }) => {
			state.bidders = action.payload;
		},

		// -------------------------------------
		// SET Bids Challenges
		setChallenges: (state, action: { payload: ApiBidsChallenges }) => {
			state.challenges = action.payload;
		},

		// -------------------------------------
		// SET Bids Positions
		setPositions: (state, action: { payload: ApiBidsPositions }) => {
			state.positions = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchBidsList =
	() =>
	async (
		dispatch: Dispatch<
			| DispatchBoolean
			| DispatchApiBidsListing
			| DispatchApiBidsMapping
			| DispatchApiBidsBidders
			| DispatchApiBidsChallenges
			| DispatchApiBidsPositions
		>
	) => {
		// ---------------------------------------------------------------
		CONFIG.verbose && console.log("Loading [REDUX]: BidsList");

		try {
			// ---------------------------------------------------------------
			// Read bids directly from chain (ChallengeAverted/Succeeded scan)
			const { list, mapping, bidders, challenges, positions } = await loadBids(mainnet.id);
			dispatch(slice.actions.setList(list));
			dispatch(slice.actions.setMapping(mapping));
			dispatch(slice.actions.setBidders(bidders));
			dispatch(slice.actions.setChallenges(challenges));
			dispatch(slice.actions.setPositions(positions));

			// ---------------------------------------------------------------
			// Finalizing, loaded set to true
			dispatch(slice.actions.setLoaded(true));
		} catch (error) {
			// ---------------------------------------------------------------
			// Error, show toast message
			showErrorToast({ message: "Fetching BidsList", error });
		}
	};
