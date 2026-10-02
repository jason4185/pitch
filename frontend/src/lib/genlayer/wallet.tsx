import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createTransactionKit, type TransactionKit } from "@genlayer/transaction-kit";
import type { Address } from "viem";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getConnectedClient, getInjectedProvider, type BrowserProvider } from "./client";
import {
  GENLAYER_CONFIG_ERROR,
  STUDIO_NEXT_CHAIN_ID,
  STUDIO_NEXT_EXPLORER_URL,
  STUDIO_NEXT_RPC_URL,
  explorerAddressUrl,
  studioNext,
  studioNextChainIdHex,
} from "./network";
import { normalizePitchError } from "./errors";

type WalletStatus = "disconnected" | "connecting" | "connected" | "wrong-network";

export interface WalletState {
  address?: Address;
  chainId?: number;
  status: WalletStatus;
  error?: string;
  provider?: BrowserProvider;
  kit?: TransactionKit;
  connectedClient?: ReturnType<typeof getConnectedClient>;
  connect: () => Promise<void>;
  disconnect: () => Promise<boolean>;
  switchToStudioNext: () => Promise<void>;
}

const WalletContext = createContext<WalletState | undefined>(undefined);

function asAddress(value: unknown): Address | undefined {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? (value as Address)
    : undefined;
}

function asChainId(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value);
  const parsed = Number.parseInt(text, text.startsWith("0x") ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readWallet(provider: BrowserProvider) {
  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  const account = Array.isArray(accounts) ? asAddress(accounts[0]) : undefined;
  return { address: account, chainId: asChainId(chainId) };
}

async function switchWallet(provider: BrowserProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: studioNextChainIdHex }],
    });
  } catch (reason) {
    if ((reason as { code?: number }).code !== 4902) throw reason;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: studioNextChainIdHex,
          chainName: "GenLayer Studio Next",
          rpcUrls: [STUDIO_NEXT_RPC_URL],
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          blockExplorerUrls: [STUDIO_NEXT_EXPLORER_URL],
        },
      ],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: studioNextChainIdHex }],
    });
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider>();
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string>();

  const refresh = useCallback(async (nextProvider: BrowserProvider) => {
    const result = await readWallet(nextProvider);
    setProvider(nextProvider);
    setAddress(result.address);
    setChainId(result.chainId);
    setStatus(
      result.address
        ? result.chainId === STUDIO_NEXT_CHAIN_ID
          ? "connected"
          : "wrong-network"
        : "disconnected",
    );
  }, []);

  useEffect(() => {
    const injected = getInjectedProvider();
    if (!injected) return;
    void refresh(injected).catch((reason) => setError(normalizePitchError(reason)));
    const onAccountsChanged = () =>
      void refresh(injected).catch((reason) => setError(normalizePitchError(reason)));
    const onChainChanged = () =>
      void refresh(injected).catch((reason) => setError(normalizePitchError(reason)));
    const emitter = injected as BrowserProvider & {
      on?: (event: string, listener: () => void) => void;
      removeListener?: (event: string, listener: () => void) => void;
    };
    emitter.on?.("accountsChanged", onAccountsChanged);
    emitter.on?.("chainChanged", onChainChanged);
    return () => {
      emitter.removeListener?.("accountsChanged", onAccountsChanged);
      emitter.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    if (GENLAYER_CONFIG_ERROR) {
      setError(GENLAYER_CONFIG_ERROR);
      return;
    }
    const injected = getInjectedProvider();
    if (!injected) {
      setError("Install an injected EIP-1193 wallet such as MetaMask to connect.");
      return;
    }
    setStatus("connecting");
    setError(undefined);
    try {
      await injected.request({ method: "eth_requestAccounts" });
      await refresh(injected);
    } catch (reason) {
      setStatus("disconnected");
      setError(normalizePitchError(reason));
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    setAddress(undefined);
    setChainId(undefined);
    setStatus("disconnected");
    setError(undefined);
    return true;
  }, []);

  const switchToStudioNext = useCallback(async () => {
    const injected = provider ?? getInjectedProvider();
    if (!injected) return connect();
    setError(undefined);
    try {
      await switchWallet(injected);
      await refresh(injected);
    } catch (reason) {
      setError(normalizePitchError(reason));
    }
  }, [connect, provider, refresh]);

  const kit = useMemo<TransactionKit | undefined>(
    () =>
      provider && address && status === "connected"
        ? createTransactionKit({ chain: studioNext, provider, account: address })
        : undefined,
    [provider, address, status],
  );
  const connectedClient = useMemo(
    () =>
      provider && address && status === "connected"
        ? getConnectedClient(provider, address)
        : undefined,
    [provider, address, status],
  );

  const value = useMemo<WalletState>(
    () => ({
      status,
      connect,
      disconnect,
      switchToStudioNext,
      ...(address ? { address } : {}),
      ...(chainId === undefined ? {} : { chainId }),
      ...(error ? { error } : {}),
      ...(provider ? { provider } : {}),
      ...(kit ? { kit } : {}),
      ...(connectedClient ? { connectedClient } : {}),
    }),
    [
      address,
      chainId,
      status,
      error,
      provider,
      kit,
      connectedClient,
      connect,
      disconnect,
      switchToStudioNext,
    ],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletControl({ dark = false }: { dark?: boolean }) {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (wallet.status === "connecting") {
    return (
      <Button size="pill" variant={dark ? "darkOutline" : "outline"} disabled>
        Connecting…
      </Button>
    );
  }
  if (wallet.status === "wrong-network") {
    return (
      <Button size="pill" variant="lime" onClick={() => void wallet.switchToStudioNext()}>
        Switch to Studio Next
      </Button>
    );
  }
  if (wallet.status === "connected" && wallet.address) {
    return (
      <div className="relative">
        <button
          type="button"
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
            dark
              ? "border-outline-dark text-primary-foreground hover:bg-primary-foreground/10"
              : "border-border bg-card hover:bg-secondary",
          )}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label="Open connected wallet"
        >
          {shortAddress(wallet.address)}
        </button>
        {open && (
          <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-72 rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Connected wallet
            </p>
            <p className="mt-3 break-all font-mono text-xs">{wallet.address}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              GenLayer Studio Next · {STUDIO_NEXT_CHAIN_ID}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(wallet.address ?? "");
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
              >
                {copied ? "Copied" : "Copy address"}
              </Button>
              <a
                className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold hover:bg-secondary"
                href={explorerAddressUrl(wallet.address)}
                target="_blank"
                rel="noreferrer"
              >
                Explorer
              </a>
              <Button size="sm" variant="ghost" onClick={() => void wallet.disconnect()}>
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={dark ? "darkOutline" : "wallet"}
        size="pill"
        onClick={() => void wallet.connect()}
        title={wallet.error ?? "Connect an injected wallet"}
      >
        Connect Wallet
      </Button>
      {wallet.error && <span className="sr-only">{wallet.error}</span>}
    </div>
  );
}
