import { createSlice } from "@reduxjs/toolkit";
import { Address } from "viem";

// View-only (watch) address. Lets the dapp render any account's data without a
// connected wallet — used for testing the decentralized data layer and for
// spectating. Persisted to localStorage so it survives reloads.

const STORAGE_KEY = "fc:viewAddress";

function load(): Address | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		const v = window.localStorage.getItem(STORAGE_KEY);
		return v ? (v as Address) : undefined;
	} catch {
		return undefined;
	}
}

export interface ViewerState {
	viewAddress?: Address;
}

export const initialState: ViewerState = {
	viewAddress: load(),
};

export const slice = createSlice({
	name: "viewer",
	initialState,
	reducers: {
		setViewAddress: (state, action: { payload: Address | undefined }) => {
			state.viewAddress = action.payload;
			if (typeof window !== "undefined") {
				try {
					if (action.payload) window.localStorage.setItem(STORAGE_KEY, action.payload);
					else window.localStorage.removeItem(STORAGE_KEY);
				} catch {
					/* storage disabled */
				}
			}
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;
export const { setViewAddress } = slice.actions;
