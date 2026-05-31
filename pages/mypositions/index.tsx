import Head from "next/head";
import MypositionsTable from "@components/PageMypositions/MypositionsTable";
import MyPositionsChallengesTable from "@components/PageMypositions/MyPositionsChallengesTable";
import MyPositionsBidsTable from "@components/PageMypositions/MyPositionsBidsTable";
import { useRouter } from "next/router";
import { Address, isAddress, zeroAddress } from "viem";
import { shortenAddress } from "@utils";
import { useEffect, useState } from "react";
import { store } from "../../redux/redux.store";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import { fetchChallengesList } from "../../redux/slices/challenges.slice";
import { fetchBidsList } from "../../redux/slices/bids.slice";
import AppTitle from "@components/AppTitle";
import AppLink from "@components/AppLink";
import { useContractUrl } from "@hooks";
import { useConnection } from "wagmi";
import ReportsPositionsYearlyTable from "@components/PageReports/ReportsPositionsYearlyTable";
import { OwnerPositionDebt, OwnerPositionFees, OwnerPositionValueLocked } from "../report";

export default function Positions() {
	const { address } = useConnection();
	const router = useRouter();
	const paramAddr = router.query.address as Address;
	const overwrite: Address | undefined = isAddress(paramAddr) ? paramAddr : undefined;

	const [isLoading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string>("");

	const [ownerPositionFees, setOwnerPositionFees] = useState<OwnerPositionFees[]>([]);
	const [ownerPositionDebt, setOwnerPositionDebt] = useState<OwnerPositionDebt[]>([]);
	const [ownerPositionValueLocked, setOwnerPositionValueLocked] = useState<OwnerPositionValueLocked[]>([]);

	useEffect(() => {
		store.dispatch(fetchPositionsList());
		store.dispatch(fetchChallengesList());
		store.dispatch(fetchBidsList());
	}, []);

	useEffect(() => {
		// Per-owner fee/debt/value-locked analytics need an indexer (dropped).
		// The position list itself comes from on-chain redux state.
		setOwnerPositionFees([]);
		setOwnerPositionDebt([]);
		setOwnerPositionValueLocked([]);
		setError("");
	}, [address, overwrite]);

	return (
		<>
			<Head>
				<title>Frankencoin - My Positions</title>
			</Head>

			{/* Section Positions */}
			<AppTitle title="Owned Positions">
				<DisplayWarningMessage overwrite={overwrite} />
			</AppTitle>

			<MypositionsTable />

			{/* Section Report */}
			<AppTitle title="Yearly Accounts">
				<DisplayWarningMessage overwrite={overwrite} />
				<div className="text-text-secondary">
					Open positions at the end of each year as well as interest paid. See also the
					<AppLink className="" label={" report page"} href={`/report?address=${overwrite ?? address ?? zeroAddress}`} />.
				</div>
			</AppTitle>

			<ReportsPositionsYearlyTable
				address={overwrite ?? address ?? zeroAddress}
				ownerPositionFees={ownerPositionFees}
				ownerPositionDebt={ownerPositionDebt}
				ownerPositionValueLocked={ownerPositionValueLocked}
			/>

			{/* Section Challenges */}
			<AppTitle title="Initiated Challenges">
				<DisplayWarningMessage overwrite={overwrite} />
			</AppTitle>

			<MyPositionsChallengesTable />

			{/* Section Bids */}
			<AppTitle title="Your Bids">
				<DisplayWarningMessage overwrite={overwrite} />
			</AppTitle>

			<MyPositionsBidsTable />
		</>
	);
}

function DisplayWarningMessage(props: { overwrite: Address | undefined }) {
	const link = useContractUrl(props.overwrite ?? zeroAddress);
	if (props.overwrite == undefined) return;

	return (
		<div>
			<div className="font-bold text-sm">
				Public View for: {<AppLink className="" label={shortenAddress(props.overwrite)} href={link} external={true} />}
			</div>
		</div>
	);
}
