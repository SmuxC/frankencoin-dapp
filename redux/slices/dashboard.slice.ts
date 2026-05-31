import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { DashboardState, DispatchApiDailyLog, DispatchApiTransactionLog, DispatchBoolean } from "./dashboard.types";
import { ApiDailyLog, ApiTransactionLog } from "@frankencoin/api";

// --------------------------------------------------------------------------------

export const initialState: DashboardState = {
	error: null,
	loaded: false,
	dailyLog: { num: 0, logs: [] },
	txLog: {
		num: 0,
		logs: [],
		pageInfo: {
			startCursor: "",
			endCursor: "",
			hasNextPage: false,
		},
	},
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "dashboard",
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
		// SET DAILY LOG
		setDailyLog: (state, action: { payload: ApiDailyLog }) => {
			state.dailyLog = action.payload;
		},

		// -------------------------------------
		// SET TX LOG
		setTxLog: (state, action: { payload: ApiTransactionLog }) => {
			state.txLog = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
// Analytics (daily log + transaction log) come from the API/indexer and are
// dropped in the decentralized build (the /report page is removed). No-ops.
export const fetchDashboard = () => async (dispatch: Dispatch<DispatchBoolean | DispatchApiDailyLog>) => {
	dispatch(slice.actions.setLoaded(true));
};

// --------------------------------------------------------------------------------
export const fetchTransactionLogs = () => async (_dispatch: Dispatch<DispatchApiTransactionLog>) => {
	return;
};
