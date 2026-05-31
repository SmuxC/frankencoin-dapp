import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { ApiCCIPChain, ApiCCIPProposal, BridgeState } from "./bridge.types";

export const initialState: BridgeState = {
	error: null,
	loaded: false,
	proposals: [],
	chains: [],
};

export const slice = createSlice({
	name: "bridge",
	initialState,
	reducers: {
		hasError(state, action: { payload: string }) {
			state.error = action.payload;
		},
		setLoaded(state, action: { payload: boolean }) {
			state.loaded = action.payload;
		},
		setProposals(state, action: { payload: ApiCCIPProposal[] }) {
			state.proposals = action.payload;
		},
		setChains(state, action: { payload: ApiCCIPChain[] }) {
			state.chains = action.payload;
		},
	},
});

export const { reducer } = slice;

// CCIP bridge governance proposals come from the API and are dropped in the
// decentralized (mainnet-only) build. No-op so the governance UI renders empty.
export const fetchBridge = () => async (dispatch: Dispatch) => {
	dispatch(slice.actions.setProposals([]));
	dispatch(slice.actions.setChains([]));
	dispatch(slice.actions.setLoaded(true));
};
