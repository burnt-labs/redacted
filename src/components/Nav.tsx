"use client";
import Link from "next/link";
import { useAbstraxionAccount } from "@burnt-labs/abstraxion";

const GOOGLE_BLOCKED = process.env.NEXT_PUBLIC_GOOGLE_BLOCKED === "true";

export default function Nav() {
  const { isConnected, logout } = useAbstraxionAccount();

  return (
    <nav className="flex items-center justify-between py-5 px-4 sm:px-8 border-b border-border">
      <Link
        href="/"
        className="font-mono text-[13px] font-bold tracking-[0.15em] uppercase text-fg no-underline"
      >
        The [Redacted] File
      </Link>
      <div className="flex items-center gap-5">
        {GOOGLE_BLOCKED && (
          <Link
            href="/store"
            className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted no-underline hover:text-fg transition-colors"
          >
            Store
          </Link>
        )}
        {isConnected && (
          <button
            onClick={() => { logout(); window.location.href = "/"; }}
            className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted bg-transparent border-none cursor-pointer hover:text-fg transition-colors"
          >
            Log out
          </button>
        )}
      </div>
    </nav>
  );
}
