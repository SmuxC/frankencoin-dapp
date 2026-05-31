import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { CONFIG } from "../../app.config";
import { mainnet } from "viem/chains";
import { loadLeadrate, loadSavings } from "../../lib/onchain/savings";
import { showErrorToast } from "@utils";
import {
	DispatchApiLeadrateInfo,
	DispatchApiLeadrateProposed,
	DispatchApiLeadrateRate,
	DispatchApiSavingsActivity,
	DispatchApiSavingsBalance,
	DispatchApiSavingsInfo,
	DispatchApiSavingsRanked,
	DispatchBoolean,
	SavingsState,
} from "./savings.types";
import {
	ApiLeadrateInfo,
	ApiLeadrateRate,
	ApiLeadrateProposed,
	ApiSavingsBalance,
	ApiSavingsInfo,
	ApiSavingsRanked,
	ApiSavingsActivity,
} from "@frankencoin/api";
import { Address, zeroAddress } from "viem";

// --------------------------------------------------------------------------------

export const initialState: SavingsState = {
	error: null,

	leadrateLoaded: false,
	leadrateInfo: {
		rate: {} as ApiLeadrateInfo["rate"],
		proposed: {} as ApiLeadrateInfo["proposed"],
		open: {} as ApiLeadrateInfo["open"],
	},
	leadrateRate: {
		rate: {} as ApiLeadrateRate["rate"],
		list: {} as ApiLeadrateRate["list"],
	},
	leadrateProposed: {
		proposed: {} as ApiLeadrateProposed["proposed"],
		list: {} as ApiLeadrateProposed["list"],
	},

	savingsLoaded: false,
	savingsInfo: {
		status: {} as ApiSavingsInfo["status"],
		totalInterest: {} as ApiSavingsInfo["totalInterest"],
		totalBalance: {} as ApiSavingsInfo["totalBalance"],
		ratioOfSupply: 0,
	},
	savingsBalance: {} as ApiSavingsBalance,
	savingsRanked: {} as ApiSavingsRanked,
	savingsActivity: [],
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "savings",
	initialState,
	reducers: {
		// HAS ERROR
		hasError(state, action: { payload: string }) {
			state.error = action.payload;
		},

		// SET LOADED
		setLeadrateLoaded: (state, action: { payload: boolean }) => {
			state.leadrateLoaded = action.payload;
		},
		setLeadrateInfo: (state, action: { payload: ApiLeadrateInfo }) => {
			state.leadrateInfo = action.payload;
		},
		setLeadrateProposed: (state, action: { payload: ApiLeadrateProposed }) => {
			state.leadrateProposed = action.payload;
		},
		setLeadrateRate: (state, action: { payload: ApiLeadrateRate }) => {
			state.leadrateRate = action.payload;
		},

		setSavingsLoaded: (state, action: { payload: boolean }) => {
			state.savingsLoaded = action.payload;
		},
		setSavingsInfo: (state, action: { payload: ApiSavingsInfo }) => {
			state.savingsInfo = action.payload;
		},
		setSavingsBalance: (state, action: { payload: ApiSavingsBalance }) => {
			state.savingsBalance = action.payload;
		},
		setSavingsRanked: (state, action: { payload: ApiSavingsRanked }) => {
			state.savingsRanked = action.payload;
		},
		setSavingsActivity: (state, action: { payload: ApiSavingsActivity }) => {
			state.savingsActivity = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchLeadrate =
	() => async (dispatch: Dispatch<DispatchBoolean | DispatchApiLeadrateInfo | DispatchApiLeadrateProposed | DispatchApiLeadrateRate>) => {
		// ---------------------------------------------------------------
		CONFIG.verbose && console.log("Loading [REDUX]: Leadrate");

		try {
			// ---------------------------------------------------------------
			// Read current leadrate directly from chain (proposal/rate history dropped)
			const { info, proposed, rate } = await loadLeadrate(mainnet.id);
			dispatch(slice.actions.setLeadrateInfo(info));
			dispatch(slice.actions.setLeadrateProposed(proposed));
			dispatch(slice.actions.setLeadrateRate(rate));

			// ---------------------------------------------------------------
			// Finalizing, loaded set to true
			dispatch(slice.actions.setLeadrateLoaded(true));
		} catch (error) {
			// ---------------------------------------------------------------
			// Error, show toast message
			showErrorToast({ message: "Fetching Leadrate", error });
		}
	};

// --------------------------------------------------------------------------------
export const fetchSavings =
	(account: Address = zeroAddress) =>
	async (
		dispatch: Dispatch<
			DispatchBoolean | DispatchApiSavingsInfo | DispatchApiSavingsBalance | DispatchApiSavingsRanked | DispatchApiSavingsActivity
		>
	) => {
		// ---------------------------------------------------------------
		CONFIG.verbose && console.log("Loading [REDUX]: Savings");

		try {
			// ---------------------------------------------------------------
			// Read savings core directly from chain. Activity + ranked leaderboard
			// are dropped (need indexed history); personal balance is read directly
			// in the savings interaction card.
			const { info, balance } = await loadSavings(mainnet.id, account);
			dispatch(slice.actions.setSavingsInfo(info));
			dispatch(slice.actions.setSavingsBalance(balance));
			dispatch(slice.actions.setSavingsActivity([]));
			dispatch(slice.actions.setSavingsRanked([]));

			// ---------------------------------------------------------------
			// Finalizing, loaded set to true
			dispatch(slice.actions.setSavingsLoaded(true));
		} catch (error) {
			// ---------------------------------------------------------------
			// Error, show toast message
			showErrorToast({ message: "Fetching Savings", error });
		}
	};
