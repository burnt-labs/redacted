"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAbstraxionClient } from "@burnt-labs/abstraxion";
import {
  getAllBadges,
  getBadgeInfo,
  NFT_CONTRACT,
  RECLAIM_NFT_CONTRACT,
} from "@/lib/contracts";
import BadgeCard from "@/components/BadgeCard";
import Nav from "@/components/Nav";

interface BadgeEntry {
  tokenId: string;
  owner?: string;
  date?: string;
  source?: "oauth3" | "reclaim" | null;
}

export default function GalleryPage() {
  const { client: queryClient } = useAbstraxionClient();
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!queryClient || (!NFT_CONTRACT && !RECLAIM_NFT_CONTRACT)) return;

    async function fetchAllBadges() {
      try {
        const badgeResults = await getAllBadges(queryClient!);
        const entries: BadgeEntry[] = await Promise.all(
          badgeResults.map(async ({ tokenId, nftContract, source }) => {
            try {
              const info = await getBadgeInfo(queryClient!, tokenId, nftContract);
              const dateAttr = info.extension?.attributes?.find(
                (a) => a.trait_type === "date" || a.trait_type === "cleared_at"
              );
              const ownerAttr = info.extension?.attributes?.find(
                (a) => a.trait_type === "owner" || a.trait_type === "address"
              );
              return {
                tokenId,
                owner: ownerAttr?.value,
                date: dateAttr?.value,
                source,
              };
            } catch {
              return { tokenId, source };
            }
          })
        );
        setBadges(entries);
      } catch (e) {
        console.error("Failed to fetch badges:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchAllBadges();
  }, [queryClient]);

  return (
    <main className="min-h-screen flex flex-col">
      <Nav />

      <div className="flex-1 px-4 py-8 sm:px-6 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="font-serif text-3xl md:text-4xl text-fg">
              Clearance Gallery
            </h1>
            <p className="text-fg-muted text-sm">
              All verified clearance badges issued to date.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="text-fg-muted text-sm uppercase tracking-wider mb-4">
                Retrieving clearance records...
              </div>
              <div className="loading-bar max-w-xs mx-auto">
                <div className="loading-bar-inner" />
              </div>
            </div>
          ) : badges.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <p className="text-fg-muted text-sm">
                No clearances have been issued yet.
              </p>
              <Link
                href="/verify"
                className="inline-block font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg no-underline transition-all hover:bg-accent hover:text-white"
              >
                Be the First
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {badges.map((b) => (
                <BadgeCard
                  key={`${b.source}-${b.tokenId}`}
                  tokenId={b.tokenId}
                  owner={b.owner}
                  date={b.date}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
