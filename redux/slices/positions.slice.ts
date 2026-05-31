import { PositionQuery, ApiPositionsListing, ApiPositionsOwners, ApiPositionsMapping } from "@frankencoin/api";
import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { uniqueValues, showErrorToast } from "@utils";
import { mainnet } from "viem/chains";
import { CONFIG } from "../../app.config";
import { loadPositions } from "../../lib/onchain/positions";
import {
	PositionsState,
	DispatchBoolean,
	DispatchPositionQueryArray,
	DispatchPositionQueryArray2,
	DispatchApiPositionsListing,
	DispatchApiPositionsOwners,
	DispatchApiPositionsMapping,
} from "./positions.types";

// --------------------------------------------------------------------------------

export const initialState: PositionsState = {
	error: null,
	loaded: false,

	list: { num: 0, list: [] },
	mapping: { num: 0, addresses: [], map: {} },
	requests: { num: 0, addresses: [], map: {} },
	owners: { num: 0, owners: [], map: {} },

	openPositions: [],
	closedPositions: [],
	deniedPositioins: [],
	originalPositions: [],
	openPositionsByOriginal: [],
	openPositionsByCollateral: [],
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "positions",
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
		setList: (state, action: { payload: ApiPositionsListing }) => {
			state.list = action.payload;
		},

		// -------------------------------------
		// SET LIST Mapping
		setListMapping: (state, action: { payload: ApiPositionsMapping }) => {
			state.mapping = action.payload;
		},

		// -------------------------------------
		// SET REQUESTS LIST
		setRequestsList: (state, action: { payload: ApiPositionsMapping }) => {
			state.requests = action.payload;
		},

		// SET OWNERS POSITIOS
		setOwnersPositions: (state, action: { payload: ApiPositionsOwners }) => {
			state.owners = action.payload;
		},

		// -------------------------------------
		// SET OPEN POSITIONS
		setOpenPositions: (state, action: { payload: PositionQuery[] }) => {
			state.openPositions = action.payload;
		},

		// SET CLOSED POSITIONS
		setClosedPositions: (state, action: { payload: PositionQuery[] }) => {
			state.closedPositions = action.payload;
		},

		// SET DENIED POSITIONS
		setDeniedPositions: (state, action: { payload: PositionQuery[] }) => {
			state.deniedPositioins = action.payload;
		},

		// SET ORIGINAL POSITIONS
		setOriginalPositions: (state, action: { payload: PositionQuery[] }) => {
			state.originalPositions = action.payload;
		},

		// SET OPEN POSITIONS BY ORIGINAL
		setOpenPositionsByOriginal: (state, action: { payload: PositionQuery[][] }) => {
			state.openPositionsByOriginal = action.payload;
		},

		// SET OPEN POSITIONS BY COLLATERAL
		setOpenPositionsByCollateral: (state, action: { payload: PositionQuery[][] }) => {
			state.openPositionsByCollateral = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchPositionsList =
	() =>
	async (
		dispatch: Dispatch<
			| DispatchBoolean
			| DispatchApiPositionsListing
			| DispatchApiPositionsMapping
			| DispatchApiPositionsOwners
			| DispatchPositionQueryArray
			| DispatchPositionQueryArray2
		>
	) => {
		// ---------------------------------------------------------------
		CONFIG.verbose && console.log("Loading [REDUX]: PositionsList");

		try {
			// ---------------------------------------------------------------
			// Read positions directly from chain (discovery via cached log scan).
			const { list, mapping, owners, requests } = await loadPositions(mainnet.id);
			dispatch(slice.actions.setList(list));
			dispatch(slice.actions.setListMapping(mapping));
			dispatch(slice.actions.setOwnersPositions(owners));
			dispatch(slice.actions.setRequestsList(requests));

			// ---------------------------------------------------------------
			// filter positions and dispatch
			const listArray = list.list as PositionQuery[];
			const openPositions = listArray.filter(
				(position) => !position.denied && !position.closed && BigInt(position.collateralBalance) > 0n
			);
			const collateralAddresses = openPositions.map((position) => position.collateral).filter(uniqueValues);

			// const requestedPositions = collateralAddresses.map((con) => listArray.filter((position) => position.collateral == con));
			const closedPositioins = listArray.filter((position) => position.closed);
			const deniedPositioins = listArray.filter((position) => position.denied);
			const originalPositions = openPositions.filter((position) => position.isOriginal);
			const openPositionsByOriginal = originalPositions.map((o) => openPositions.filter((p) => p.original == o.original));
			const openPositionsByCollateral = collateralAddresses.map((con) =>
				openPositions.filter((position) => position.collateral == con)
			);

			dispatch(slice.actions.setOpenPositions(openPositions));
			dispatch(slice.actions.setClosedPositions(closedPositioins));
			dispatch(slice.actions.setDeniedPositions(deniedPositioins));
			dispatch(slice.actions.setOriginalPositions(originalPositions));
			dispatch(slice.actions.setOpenPositionsByOriginal(openPositionsByOriginal));
			dispatch(slice.actions.setOpenPositionsByCollateral(openPositionsByCollateral));

			// ---------------------------------------------------------------
			// Finalizing, loaded set to true
			dispatch(slice.actions.setLoaded(true));
		} catch (error) {
			// ---------------------------------------------------------------
			// Error, show toast message
			showErrorToast({ message: "Fetching PositionsList", error });
		}
	};
