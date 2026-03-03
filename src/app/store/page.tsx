"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  useAbstraxionAccount,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion";
import {
  isCleared,
  getUserBadge,
  NFT_CONTRACT,
  RECLAIM_NFT_CONTRACT,
} from "@/lib/contracts";
import ProductCard from "@/components/ProductCard";
import Nav from "@/components/Nav";

const GOOGLE_BLOCKED = process.env.NEXT_PUBLIC_GOOGLE_BLOCKED === "true";

export default function StorePage() {
  const { data: account, login } = useAbstraxionAccount();
  const { client: queryClient } = useAbstraxionClient();
  const [cleared, setCleared] = useState<boolean | null>(null);
  const [badgeId, setBadgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isConnected = !!account?.bech32Address;

  useEffect(() => {
    if (!queryClient || !isConnected || (!NFT_CONTRACT && !RECLAIM_NFT_CONTRACT))
      return;

    async function checkClearance() {
      try {
        const hasBadge = await isCleared(queryClient!, account!.bech32Address);
        setCleared(hasBadge);
        if (hasBadge) {
          const { tokenIds } = await getUserBadge(
            queryClient!,
            account!.bech32Address
          );
          if (tokenIds.length > 0) setBadgeId(tokenIds[0]);
        }
      } catch (e) {
        console.error("Failed to check clearance:", e);
        setCleared(false);
      } finally {
        setLoading(false);
      }
    }

    checkClearance();
  }, [queryClient, isConnected, account]);

  if (GOOGLE_BLOCKED) {
    return (
      <main className="min-h-screen flex flex-col">
        <Nav />

        <div className="flex-1 flex flex-col items-center px-6 py-14">
          <div className="w-full max-w-[560px]">
            <div className="text-center mb-10 space-y-3">
              <h1 className="font-serif text-[32px] sm:text-[42px] text-fg">
                Store
              </h1>
              <p className="text-[15px] leading-[1.6] text-fg-muted max-w-[400px] mx-auto">
                Verification is down, so the store is open to everyone.<br />
                Go support a worthy cause.
              </p>
            </div>

            <div className="border border-cleared/30 p-4 text-center mb-10">
              <p className="text-cleared text-sm font-bold uppercase tracking-widest">
                100% of Proceeds Go to the{" "}
                <a
                  href="https://www.asiyahwomenscenter.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-[3px] hover:text-fg transition-colors"
                >
                  Asiyah Women&apos;s Center
                </a>
              </p>
            </div>

            <ProductCard badgeId={null} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Nav />

      <div className="flex-1 flex flex-col items-center px-4 py-8 sm:px-6 sm:py-16">
        <div className="text-center mb-12 space-y-4">
          <h1 className="font-serif text-3xl md:text-4xl text-fg">
            Store
          </h1>
          <p className="text-fg-muted text-sm max-w-md mx-auto">
            Exclusive merchandise for cleared individuals only.
          </p>
        </div>

        <div className="w-full max-w-lg mb-8">
          <div className="border border-cleared/30 p-4 text-center">
            <p className="text-cleared text-sm font-bold uppercase tracking-widest">
              100% of Proceeds Go to the Asiyah Women&apos;s Center
            </p>
          </div>
        </div>

        {!isConnected && (
          <div className="w-full max-w-md">
            <div className="border border-border p-4 sm:p-8 text-center space-y-6">
              <div className="text-fg-muted text-sm uppercase tracking-wider">
                Authentication required
              </div>
              <p className="text-sm text-fg-muted">
                Connect your wallet to access the store.
              </p>
              <button
                onClick={() => login()}
                className="w-full font-mono text-[12px] font-bold tracking-[0.15em] uppercase py-3 bg-fg text-bg transition-all hover:bg-accent hover:text-white"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}

        {isConnected && loading && (
          <div className="space-y-4 w-full max-w-xs text-center">
            <div className="text-fg-muted text-sm uppercase tracking-wider">
              Checking clearance level
            </div>
            <div className="loading-bar">
              <div className="loading-bar-inner" />
            </div>
          </div>
        )}

        {isConnected && !loading && !cleared && (
          <div className="w-full max-w-md">
            <div className="border border-border p-4 sm:p-8 text-center space-y-6 relative">
              <h2 className="font-serif text-2xl text-fg">Clearance Required</h2>
              <p className="text-sm text-fg-muted">
                Access to the store requires a valid clearance badge.
                Complete the verification process to prove your inbox is clean.
              </p>
              <Link
                href="/verify"
                className="inline-block font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg no-underline transition-all hover:bg-accent hover:text-white"
              >
                Get Cleared
              </Link>
            </div>
          </div>
        )}

        {isConnected && !loading && cleared && (
          <div className="w-full max-w-lg">
            <ProductCard badgeId={badgeId} />
          </div>
        )}
      </div>
    </main>
  );
}
