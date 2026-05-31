import { useConnection } from "wagmi";
import { useSelector } from "react-redux";
import { Address } from "viem";
import { RootState } from "../redux/redux.store";

// The address the dapp should READ data for: the view-only "watch" address if
// set, otherwise the connected wallet. Write/sign actions must keep using the
// wallet address directly (useConnection) — a watched address cannot sign.
export function useActiveAccount(): {
	address: Address | undefined;
	walletAddress: Address | undefined;
	isViewOnly: boolean;
} {
	const { address: walletAddress } = useConnection();
	const viewAddress = useSelector((state: RootState) => state.viewer.viewAddress);
	return {
		address: viewAddress ?? walletAddress,
		walletAddress,
		isViewOnly: !!viewAddress,
	};
}
