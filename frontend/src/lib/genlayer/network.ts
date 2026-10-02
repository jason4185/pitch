import { studioDevnet } from "genlayer-js/chains";
import type { GenLayerChain } from "@genlayer/transaction-kit";
import { isAddress, type Address } from "viem";

const configuredChainId = import.meta.env["VITE_GENLAYER_CHAIN_ID"] as string | undefined;
const configuredRpcUrl = import.meta.env["VITE_GENLAYER_RPC_URL"] as string | undefined;
const configuredContractAddress = import.meta.env["VITE_GENLAYER_CONTRACT_ADDRESS"] as
  string | undefined;

export const STUDIO_NEXT_CHAIN_ID = 61997;
export const PITCH_CHAIN_ID = STUDIO_NEXT_CHAIN_ID;
export const STUDIO_NEXT_RPC_URL = configuredRpcUrl ?? "";
export const STUDIO_NEXT_EXPLORER_URL = "https://explorer-studio-dev.genlayer.com";
export const PITCH_CONTRACT_ADDRESS = (
  configuredContractAddress && isAddress(configuredContractAddress)
    ? configuredContractAddress
    : "0x0000000000000000000000000000000000000000"
) as Address;

const parsedChainId = configuredChainId ? Number(configuredChainId) : Number.NaN;
const configurationErrors = [
  configuredRpcUrl ? undefined : "VITE_GENLAYER_RPC_URL is missing.",
  configuredChainId && parsedChainId === STUDIO_NEXT_CHAIN_ID
    ? undefined
    : `VITE_GENLAYER_CHAIN_ID must be ${STUDIO_NEXT_CHAIN_ID}.`,
  configuredContractAddress && isAddress(configuredContractAddress)
    ? undefined
    : "VITE_GENLAYER_CONTRACT_ADDRESS is missing or invalid.",
].filter((value): value is string => Boolean(value));

export const GENLAYER_CONFIG_ERROR = configurationErrors.join(" ");

export const studioNext = {
  ...studioDevnet,
  id: STUDIO_NEXT_CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: {
    default: {
      http: [STUDIO_NEXT_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "GenLayer Studio Explorer",
      url: STUDIO_NEXT_EXPLORER_URL,
    },
  },
} satisfies GenLayerChain;

export const studioNextChainIdHex = `0x${STUDIO_NEXT_CHAIN_ID.toString(16)}`;

export function explorerTransactionUrl(txId: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/tx/${txId}`;
}

export function explorerAddressUrl(address: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/address/${address}`;
}

export function assertGenLayerConfiguration() {
  if (GENLAYER_CONFIG_ERROR) throw new Error(GENLAYER_CONFIG_ERROR);
}
