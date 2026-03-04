"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAbstraxionClient, useAbstraxionAccount } from "@burnt-labs/abstraxion";
import {
  getUserBadge,
  getBadgeInfo,
  NFT_CONTRACT,
  RECLAIM_NFT_CONTRACT,
} from "@/lib/contracts";
import ProductCard from "@/components/ProductCard";

const EXPLORER_TX_URL = process.env.NEXT_PUBLIC_EXPLORER_TX_URL || "https://www.mintscan.io/xion-testnet/tx";
const REST_URL = process.env.NEXT_PUBLIC_REST_URL || "https://api.xion-testnet-2.burnt.com";

async function fetchMintTxHash(address: string, source: "oauth3" | "reclaim" | null): Promise<string | null> {
  const action = source === "reclaim" ? "mint_verified" : "submit_proof";
  try {
    const query = encodeURIComponent(`wasm.action='${action}' AND wasm.recipient='${address}'`);
    const url = `${REST_URL}/cosmos/tx/v1beta1/txs?query=${query}&order_by=ORDER_BY_DESC&pagination.limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.tx_responses?.[0]?.txhash || null;
  } catch {
    return null;
  }
}

interface BadgeData {
  tokenId: string;
  name?: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  source?: "oauth3" | "reclaim";
}

const ADDRESS_PATTERN = /^xion1[a-z0-9]{38,58}$/;

export default function BadgeContent({ address }: { address: string }) {
  const { client: queryClient } = useAbstraxionClient();
  const { logout } = useAbstraxionAccount();
  const searchParams = useSearchParams();
  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isValidAddress = ADDRESS_PATTERN.test(address);

  const txHashParam = searchParams.get("tx");
  const method = searchParams.get("method") as "oauth3" | "reclaim" | null;
  const [mintTxHash, setMintTxHash] = useState<string | null>(txHashParam);

  useEffect(() => {
    if (!queryClient || (!NFT_CONTRACT && !RECLAIM_NFT_CONTRACT)) return;
    if (!isValidAddress) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchBadge() {
      try {
        const { tokenIds, source } = await getUserBadge(queryClient!, address);
        if (tokenIds.length === 0) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const tokenId = tokenIds[0];
        const nftContract =
          source === "reclaim" ? RECLAIM_NFT_CONTRACT : NFT_CONTRACT;
        const info = await getBadgeInfo(queryClient!, tokenId, nftContract);
        setBadge({
          tokenId,
          name: info.extension?.name,
          description: info.extension?.description,
          attributes: info.extension?.attributes,
          source: source || method || undefined,
        });

        // If no tx hash from URL params, look up the mint transaction
        if (!txHashParam) {
          fetchMintTxHash(address, source || method).then(setMintTxHash);
        }
      } catch (e) {
        console.error("Failed to fetch badge:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchBadge();
  }, [queryClient, address, method, txHashParam, isValidAddress]);

  const explorerUrl = mintTxHash ? `${EXPLORER_TX_URL}/${mintTxHash}` : null;

  const truncatedAddress = `${address.slice(0, 14)}...${address.slice(-8)}`;

  const methodLabel =
    badge?.source === "reclaim"
      ? "zkTLS (Reclaim)"
      : badge?.source === "oauth3"
        ? "TEE Attestation"
        : "Inbox Scan";

  if (loading) {
    return (
      <div className="space-y-4 w-full max-w-xs mx-auto text-center">
        <div className="text-fg-muted text-sm uppercase tracking-wider">
          Retrieving clearance record
        </div>
        <div className="loading-bar">
          <div className="loading-bar-inner" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center space-y-6">
        <h2 className="font-serif text-[32px] text-fg">No Clearance Found</h2>
        <p className="text-fg-muted text-[14px]">
          Address {truncatedAddress} has not been cleared.
        </p>
        <Link
          href="/verify"
          className="inline-block font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg no-underline transition-all hover:bg-accent hover:text-white"
        >
          Get Cleared
        </Link>
        <button
          onClick={() => { logout(); window.location.href = "/verify"; }}
          className="block mx-auto mt-4 font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted bg-transparent border-none cursor-pointer underline underline-offset-[3px] hover:text-fg transition-colors"
        >
          Wrong account? Log out
        </button>
      </div>
    );
  }

  if (!badge) return null;

  return (
    <div className="w-full">
      {/* Certificate */}
      <div className="border-[1.5px] border-border-dark p-12 relative bg-bg max-[600px]:p-6 max-[600px]:px-6">
        {/* Corner accents */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Top-left */}
          <div className="absolute top-2 left-2 w-5 h-5 border-t-[1.5px] border-l-[1.5px] border-fg" />
          {/* Top-right */}
          <div className="absolute top-2 right-2 w-5 h-5 border-t-[1.5px] border-r-[1.5px] border-fg" />
          {/* Bottom-left */}
          <div className="absolute bottom-2 left-2 w-5 h-5 border-b-[1.5px] border-l-[1.5px] border-fg" />
          {/* Bottom-right */}
          <div className="absolute bottom-2 right-2 w-5 h-5 border-b-[1.5px] border-r-[1.5px] border-fg" />
        </div>

        {/* Label */}
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-fg-muted text-center mb-5">
          Clearance Certificate
        </div>

        {/* Title */}
        <div className="font-serif text-[48px] text-center text-fg mb-1 leading-[1.1] max-[600px]:text-[36px]">
          Cleared
        </div>
        <div className="font-mono text-[13px] tracking-[0.15em] text-fg-muted text-center mb-8">
          #{badge.tokenId.padStart(6, "0")}
        </div>

        {/* Divider */}
        <div className="h-px bg-border mb-7" />

        {/* Support Victims section */}
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-fg-light mb-3">
            Support Victims
          </div>
          <p className="text-[14px] leading-[1.65] text-fg-muted max-w-[360px] mx-auto mb-5">
            Grab a tee reserved for people who aren&apos;t on the list. All proceeds go to the{" "}<a href="https://www.asiyahwomenscenter.org/" target="_blank" rel="noopener noreferrer" className="text-fg underline underline-offset-[3px] hover:text-accent transition-colors">Asiyah Center</a>, a women&apos;s shelter for domestic and sexual violence survivors.
          </p>
          <div className="flex justify-center">
            <ProductCard badgeId={badge.tokenId} />
          </div>
        </div>
      </div>

      {/* Share section */}
      <div className="mt-8 border border-border p-6 text-center space-y-4">
        <p className="text-[14px] leading-[1.7] text-fg-muted">
          The more people who prove they&apos;re clean, the more conspicuous the ones who don&apos;t.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.origin);
              } catch {
                const input = document.createElement("input");
                input.value = window.location.origin;
                document.body.appendChild(input);
                input.select();
                document.execCommand("copy");
                document.body.removeChild(input);
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted border border-border px-4 py-2 bg-transparent cursor-pointer transition-all hover:border-fg hover:text-fg"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I wasn\u2019t on the Epstein list. Were you?\n\nProve it.\n\n")}${encodeURIComponent(window.location.origin)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted border border-border px-4 py-2 no-underline transition-all hover:border-fg hover:text-fg text-center"
          >
            Share to Twitter
          </a>
        </div>
      </div>

      {/* Proof details dropdown */}
      <div className={`mt-8 border border-border ${detailsOpen ? "" : ""}`}>
        <button
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="w-full flex items-center justify-between px-6 py-4 bg-transparent border-none cursor-pointer font-mono text-[11px] tracking-[0.15em] uppercase text-fg-muted transition-colors hover:text-fg"
        >
          <span>View Proof Details</span>
          <svg
            className={`transition-transform duration-300 ${detailsOpen ? "rotate-180" : ""}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {detailsOpen && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="flex justify-between items-baseline max-[600px]:flex-col max-[600px]:gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-light">Status</span>
              <span className="font-mono text-[12px] tracking-[0.05em] text-cleared font-bold">Cleared</span>
            </div>
            <div className="flex justify-between items-baseline max-[600px]:flex-col max-[600px]:gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-light">Method</span>
              <span className="font-mono text-[12px] tracking-[0.05em] text-fg">{methodLabel}</span>
            </div>
            <div className="flex justify-between items-baseline max-[600px]:flex-col max-[600px]:gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-light">Record</span>
              <span className="font-mono text-[12px] tracking-[0.05em]">
                <a
                  href={explorerUrl || `https://www.mintscan.io/xion-testnet/address/${NFT_CONTRACT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cleared underline underline-offset-[3px] hover:text-fg transition-colors"
                >
                  View on chain
                </a>
              </span>
            </div>
            <div className="flex justify-between items-baseline max-[600px]:flex-col max-[600px]:gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-light">Subject</span>
              <span className="font-mono text-[12px] tracking-[0.05em] bg-redact text-bg px-1.5 py-0.5 select-none">Redacted</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
