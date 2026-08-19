"use client";
import { useState, useEffect, useCallback } from "react";

export default function OverloadedPage() {
  const [countdown, setCountdown] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = "/";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = useCallback(() => {
    window.location.href = "/";
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = window.location.origin;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const progress = ((30 - countdown) / 30) * 100;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Decorative redact bars - left */}
      <div className="absolute left-10 top-[20%] flex-col gap-1.5 opacity-[0.08] hidden min-[900px]:flex">
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 180 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 120 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 200 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 80 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 160 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 100 }} />
      </div>

      {/* Decorative redact bars - right */}
      <div className="absolute right-10 bottom-[20%] flex-col gap-1.5 opacity-[0.08] hidden min-[900px]:flex">
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 140 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 200 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 100 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 170 }} />
        <div className="bg-redact rounded-sm h-2.5" style={{ width: 130 }} />
      </div>

      <div className="max-w-[520px] w-full text-center space-y-10">
        {/* Status label */}
        <div>
          <span className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase text-accent border border-accent px-3 py-1">
            System Status: Overwhelmed
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-[36px] sm:text-[48px] text-fg leading-[1.05] tracking-[-0.02em]">
          Too Many People Want to Prove They&apos;re Clean
        </h1>

        {/* Body copy */}
        <div className="space-y-4 text-[15px] leading-[1.7] text-fg-muted">
          <p>
            We&apos;re experiencing unprecedented demand. It turns out a lot of people are very eager to prove they never emailed Jeffrey Epstein.
          </p>
          <p>
            The truth can wait a few minutes.
          </p>
        </div>

        {/* Retry countdown */}
        <div className="space-y-4 max-w-xs mx-auto">
          <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-fg-muted">
            Auto-retry in {countdown}s
          </div>
          <div className="loading-bar">
            <div
              className="loading-bar-inner"
              style={{
                width: `${progress}%`,
                animation: "none",
                transition: "width 1s linear",
              }}
            />
          </div>
          <button
            onClick={handleRetry}
            className="w-full font-mono text-[12px] font-bold tracking-[0.15em] uppercase py-3.5 bg-fg text-bg transition-all hover:bg-accent hover:text-white"
          >
            Try Again Now
          </button>
        </div>

        {/* While you wait */}
        <div className="border border-border p-4 sm:p-6 space-y-4">
          <div className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-fg">
            While You Wait
          </div>
          <p className="text-[14px] leading-[1.7] text-fg-muted">
            Share the site. The more people who get cleared, the more interesting the list of people who don&apos;t becomes.
          </p>
          <button
            onClick={handleCopyLink}
            className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted border border-border px-4 py-2 bg-transparent cursor-pointer transition-all hover:border-fg hover:text-fg"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-fg-light">
          All proceeds from The [Redacted] File store go directly to supporting victims through the Asiyah Women&apos;s Center.
        </p>
      </div>
    </main>
  );
}
