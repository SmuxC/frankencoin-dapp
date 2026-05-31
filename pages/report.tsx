import Head from "next/head";
import { useConnection } from "wagmi";
import AppTitle from "@components/AppTitle";
import AddressInput from "@components/Input/AddressInput";
import { useEffect, useState } from "react";
import AppCard from "@components/AppCard";
import { Address, isAddress, zeroAddress } from "viem";
import ReportsSavingsYearlyTable from "@components/PageReports/ReportsSavingsYearlyTable";
import { useFPSBalanceHistory, useFPSEarningsHistory } from "@hooks";
import ReportsFPSYearlyTable from "@components/PageReports/ReportsFPSYearlyTable";
import ReportsPositionsYearlyTable from "@components/PageReports/ReportsPositionsYearlyTable";
import { useRef } from "react";
import generatePDF, { Margin } from "react-to-pdf";
import { useRouter } from "next/router";
import DateInput from "@components/Input/DateInput";
import { ApiSavingsActivity } from "@frankencoin/api";
import { normalizeAddress } from "@utils";

export type OwnerPositionFees = {
	t: number;
	f: bigint;
};

export type OwnerPositionDebt = {
	y: number;
	d: bigint;
};

export type OwnerPositionValueLocked = {
	y: number;
	v: bigint;
};

export default function ReportPage() {
	const targetRef = useRef<HTMLDivElement>(null); // for pdf print
	const { address } = useConnection();
	const [isLoading, setLoading] = useState<boolean>(false);
	const [isExporting, setExporting] = useState<boolean>(false);
	const [reportingAddress, setReportingAddress] = useState<string>(address ?? "");
	const [error, setError] = useState<string>("");
	const [ownerPositionFees, setOwnerPositionFees] = useState<OwnerPositionFees[]>([]);
	const [ownerPositionDebt, setOwnerPositionDebt] = useState<OwnerPositionDebt[]>([]);
	const [ownerPositionValueLocked, setOwnerPositionValueLocked] = useState<OwnerPositionValueLocked[]>([]);
	const [savings, setSavings] = useState<ApiSavingsActivity>([]);

	const router = useRouter();
	const overwrite: Address = router.query.address as Address;

	const resolvedAddress = isAddress(reportingAddress) ? normalizeAddress(reportingAddress) : zeroAddress;
	const fpsHistory = useFPSBalanceHistory(resolvedAddress);
	const fpsEarnings = useFPSEarningsHistory(resolvedAddress);

	useEffect(() => {
		if (overwrite == undefined || overwrite.length == 0) return;
		if (isAddress(overwrite)) {
			setReportingAddress(overwrite);
		}
	}, [overwrite]);

	useEffect(() => {
		if (reportingAddress == "") {
			setError("");
			return;
		}

		if (!isAddress(reportingAddress)) {
			setOwnerPositionFees([]);
			setSavings([]);
			setError("Invalid Address");
			return;
		}

		// The accounting report aggregates per-owner fee/debt/value-locked and
		// savings history — all indexed data, dropped in the decentralized build.
		// The page renders empty for now.
		setOwnerPositionFees([]);
		setOwnerPositionDebt([]);
		setOwnerPositionValueLocked([]);
		setSavings([]);
		setError("");
	}, [reportingAddress]);

	useEffect(() => {
		if (!isExporting) return;

		generatePDF(targetRef, {
			filename: `FrankencoinReport-${reportingAddress}.pdf`,
			page: {
				margin: Margin.LARGE,
				format: "A4",
				orientation: "portrait",
			},
		});

		setExporting(false);
	}, [isExporting, reportingAddress]);

	const handlePDFCreation = () => {
		setExporting(true);
	};

	return (
		<div className={`grid gap-8 ${isExporting ? "w-[60rem]" : ""}`} ref={targetRef}>
			<Head>
				<title>Frankencoin - Report</title>
			</Head>

			<AppTitle title={`Frankencoin Wealth and Income Report`}>
				<div className="text-text-secondary">
					Track the yearly wealth, income, debt, and costs attributable to a given address. For the current year, the values
					reflect the accrued amounts up to the current date. All data is provided on a &apos;best effort&apos; basis without any
					guarantee of accuracy. The contents of this page are also available as{" "}
					<span className="text-card-input-min hover:text-card-input-hover cursor-pointer" onClick={handlePDFCreation}>
						pdf download
					</span>
					.
				</div>
			</AppTitle>

			<AppCard>
				<div className="grid md:gap-8 md:grid-cols-3 items-center -mb-4">
					<DateInput className="" label="Current Date" value={new Date()} disabled={true} />

					<AddressInput
						className="col-span-2"
						label="Address of Interest"
						value={reportingAddress}
						onChange={setReportingAddress}
						disabled={isLoading}
						error={error}
					/>
				</div>
			</AppCard>

			<AppTitle title="Collateralized Debt Positions">
				<div className="text-text-secondary">Open positions at the end of each year as well as interest paid.</div>
			</AppTitle>
			<ReportsPositionsYearlyTable
				address={reportingAddress as Address}
				ownerPositionFees={ownerPositionFees}
				ownerPositionDebt={ownerPositionDebt}
				ownerPositionValueLocked={ownerPositionValueLocked}
			/>
			<div className="text-text-secondary text-sm -mt-7">
				Note: Interest payments are recorded in the year they are made, even if they cover interest accrued in a different period.
			</div>

			<AppTitle title="Savings">
				<div className="text-text-secondary">Interest collected for each period as well as the year end balances.</div>
			</AppTitle>
			<ReportsSavingsYearlyTable activity={savings} />

			<AppTitle title="Equity Participation">
				<div className="text-text-secondary">
					Attributable income for each year, as well as the balance and its value at the end of the year. Attributable income is
					the sum of all income and loss events, weighted by the held FPS tokens relative to the total supply at each relevant
					point in time.
				</div>
			</AppTitle>
			<ReportsFPSYearlyTable address={reportingAddress as Address} fpsHistory={fpsHistory} fpsEarnings={fpsEarnings} />
		</div>
	);
}
