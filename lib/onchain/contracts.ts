import { ADDRESS } from "@frankencoin/zchf";

// Mainnet-typed contract address accessor. The dapp's decentralized data layer
// is mainnet-only (positions, challenges, mint, savings, equity all live on L1),
// so we narrow off the multi-chain ADDRESS union to the mainnet shape.
export const contractsFor = (chainId: number) => ADDRESS[chainId as keyof typeof ADDRESS] as (typeof ADDRESS)[1];
