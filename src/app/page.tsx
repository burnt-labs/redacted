"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAbstraxionClient } from "@burnt-labs/abstraxion";
import { getBadgeCount, NFT_CONTRACT, RECLAIM_NFT_CONTRACT } from "@/lib/contracts";
import Nav from "@/components/Nav";

const GOOGLE_BLOCKED = process.env.NEXT_PUBLIC_GOOGLE_BLOCKED === "true";

export default function Home() {
  const { client: queryClient } = useAbstraxionClient();
  const [badgeCount, setBadgeCount] = useState<number | null>(null);

  useEffect(() => {
    if (!queryClient || (!NFT_CONTRACT && !RECLAIM_NFT_CONTRACT)) return;
    getBadgeCount(queryClient)
      .then(setBadgeCount)
      .catch(() => setBadgeCount(null));
  }, [queryClient]);

  return (
    <main className="min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 sm:px-8 py-[60px] pb-12 relative">
        {/* Decorative redact bars - left */}
        <div className="absolute left-10 top-[30%] flex-col gap-1.5 opacity-[0.12] hidden min-[900px]:flex">
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 180 }} />
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 120 }} />
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 200 }} />
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 80 }} />
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 160 }} />
        </div>

        {/* Decorative redact bars - right */}
        <div className="absolute right-10 bottom-[25%] flex-col gap-1.5 opacity-[0.12] hidden min-[900px]:flex">
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 140 }} />
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 200 }} />
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 100 }} />
          <div className="bg-redact rounded-sm h-2.5" style={{ width: 170 }} />
        </div>

        <p className="font-mono text-[11px] tracking-[0.35em] uppercase text-fg-muted mb-7">
          The [Redacted] File
        </p>

        <h1 className="font-serif font-normal leading-[0.92] tracking-[-0.02em] text-fg mb-2" style={{ fontSize: "clamp(52px, 10vw, 120px)" }}>
          The Epstein<br />
          <span className="inline-block bg-redact text-bg px-4 py-1 ml-2">Files</span>
        </h1>

        <p className="font-serif italic text-fg-muted mt-5 mb-10" style={{ fontSize: "clamp(18px, 2.5vw, 26px)" }}>
          {GOOGLE_BLOCKED
            ? "They don\u2019t want you to prove your innocence. We wonder why."
            : "Prove you never emailed Jeffrey Epstein. Publicly. Permanently."}
        </p>

        {badgeCount !== null && (
          <div className="inline-flex items-center gap-2.5 font-mono text-[12px] text-fg-muted border border-border bg-bg-paper px-[18px] py-2 mb-10">
            <span className="w-[7px] h-[7px] bg-cleared rounded-full animate-pulse-slow" />
            <span><strong className="text-fg font-bold">{badgeCount.toLocaleString()}</strong> clearances issued</span>
          </div>
        )}

        {GOOGLE_BLOCKED && (
          <div className="bg-accent/10 border-2 border-accent p-4 sm:p-6 mb-10 max-w-[520px] w-full text-center">
            <div className="font-mono text-[11px] font-bold tracking-[0.25em] uppercase text-accent mb-3">
              Shut Down by Google
            </div>
            <p className="text-[15px] leading-[1.6] text-fg">
              Google revoked API access to an app that proves you never emailed Jeffrey Epstein. Wonder why.
            </p>
            <p className="text-[13px] leading-[1.6] text-fg-muted mt-2">
              Verification is down, so the store is open to everyone.<br />
              Go support a worthy cause.
            </p>
          </div>
        )}

        <Link
          href={GOOGLE_BLOCKED ? "/store" : "/verify"}
          className={`inline-block font-mono text-[13px] font-bold tracking-[0.18em] uppercase px-12 py-4 no-underline transition-all ${
            GOOGLE_BLOCKED
              ? "bg-accent text-white border-2 border-accent hover:bg-accent/80"
              : "bg-fg text-bg hover:bg-accent hover:text-white"
          }`}
        >
          {GOOGLE_BLOCKED ? "Buy a Shirt" : "Get Cleared"}
        </Link>
      </section>

      {/* Document Strip */}
      <section className="border-t border-border py-12 px-4 sm:px-8 overflow-hidden">
        <div className="max-w-[1100px] mx-auto relative text-center">
          <p className="font-serif italic text-[22px] leading-[1.6] text-fg-muted max-[600px]:text-[18px]">
            &ldquo;You generate your own proof. Nothing ever leaves the secure hardware environment. No one sees anything but the result: <span className="redact-inline">cleared</span> or not.&rdquo;
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border py-20 px-4 sm:px-8">
        <h2 className="font-serif text-[40px] tracking-[-0.01em] text-fg text-center mb-16">
          How It Works
        </h2>
        <div className="flex max-w-[960px] mx-auto max-[900px]:flex-col max-[900px]:gap-12">
          <div className="flex-1 px-8 max-[900px]:px-0">
            <div className="font-serif text-[64px] text-fg leading-none tracking-[-0.03em]">01</div>
            <div className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-fg mt-5 mb-3">Connect Your Inbox</div>
            <p className="text-[14px] leading-[1.7] text-fg-muted">Sign in with Google. Nothing ever leaves the secure hardware environment. No one can see your emails.</p>
          </div>
          <div className="flex-1 px-8 border-l border-border max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:border-border max-[900px]:pt-12 max-[900px]:px-0">
            <div className="font-serif text-[64px] text-fg leading-none tracking-[-0.03em]">02</div>
            <div className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-fg mt-5 mb-3">Prove You Aren&apos;t a Piece of Shit</div>
            <p className="text-[14px] leading-[1.7] text-fg-muted">Your proof reveals one thing: whether Jeffrey Epstein&apos;s email ever appeared in your inbox. Nothing else. Just cleared or not.</p>
          </div>
          <div className="flex-1 px-8 border-l border-border max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:border-border max-[900px]:pt-12 max-[900px]:px-0">
            <div className="font-serif text-[64px] text-fg leading-none tracking-[-0.03em]">03</div>
            <div className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-fg mt-5 mb-3">Wear the Proof</div>
            <p className="text-[14px] leading-[1.7] text-fg-muted">Cleared? Grab a tshirt that only verified people can buy. All proceeds go to the{" "}<a href="https://www.asiyahwomenscenter.org/" target="_blank" rel="noopener noreferrer" className="text-fg underline underline-offset-[3px] hover:text-accent transition-colors">Asiyah Women&apos;s Center</a>.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4 sm:px-8 text-center">
        <p className="text-[12px] leading-[1.7] text-fg-light max-w-[640px] mx-auto mb-5">
          Your proof is generated inside an isolated secure hardware environment. No one ever accesses your emails or your password. Your clearance badge is permanent, public, and tamper proof.
        </p>
        <div className="flex justify-center gap-6">
          <a
            href="https://burnt.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-fg-light no-underline border-b border-transparent transition-all hover:text-fg hover:border-fg"
          >
            Privacy Policy
          </a>
          <span className="text-border text-[10px]">|</span>
          <a
            href="https://burnt.com/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-fg-light no-underline border-b border-transparent transition-all hover:text-fg hover:border-fg"
          >
            Terms &amp; Conditions
          </a>
        </div>
      </footer>
    </main>
  );
}
