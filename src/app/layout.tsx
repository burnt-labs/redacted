"use client";
import "./globals.css";
import { useMemo } from "react";
import { AbstraxionProvider } from "@burnt-labs/abstraxion";
import { XION_CHAIN_ID, XION_RPC, XION_REST } from "@/lib/xion-config";
import "@burnt-labs/ui/dist/index.css";

const CLEARANCE_CONTRACT = process.env.NEXT_PUBLIC_CLEARANCE_CONTRACT || "";
const NFT_CONTRACT = process.env.NEXT_PUBLIC_NFT_CONTRACT || "";
const RECLAIM_CLEARANCE_CONTRACT = process.env.NEXT_PUBLIC_RECLAIM_CLEARANCE_CONTRACT || "";
const RECLAIM_NFT_CONTRACT = process.env.NEXT_PUBLIC_RECLAIM_NFT_CONTRACT || "";

const contracts = [
  CLEARANCE_CONTRACT,
  NFT_CONTRACT,
  RECLAIM_CLEARANCE_CONTRACT,
  RECLAIM_NFT_CONTRACT,
].filter(Boolean);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const treasuryConfig = useMemo(() => ({
    treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID || XION_CHAIN_ID,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || XION_RPC,
    restUrl: process.env.NEXT_PUBLIC_REST_URL || XION_REST,
    contracts,
    authentication: {
      type: "redirect" as const,
      callbackUrl: typeof window !== "undefined"
        ? window.location.origin + "/verify"
        : undefined,
    },
  }), []);
  return (
    <html lang="en">
      <head>
        <title>The [Redacted] File</title>
        <meta name="description" content="Connect your inbox, prove your innocence, support survivors." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="The [Redacted] File" />
        <meta property="og:description" content="Connect your inbox, prove your innocence, support survivors." />
        <meta property="og:url" content="https://theredactedfile.com" />
        <meta property="og:site_name" content="The [Redacted] File" />
        <meta property="og:image" content="https://theredactedfile.com/og-image.png" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The [Redacted] File" />
        <meta name="twitter:description" content="Connect your inbox, prove your innocence, support survivors." />
        <meta name="twitter:image" content="https://theredactedfile.com/og-image.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg text-fg font-sans">
        <AbstraxionProvider config={treasuryConfig}>
          {children}
        </AbstraxionProvider>
      </body>
    </html>
  );
}
