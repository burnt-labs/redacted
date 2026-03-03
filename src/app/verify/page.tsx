"use client";
import { Suspense } from "react";
import VerifyFlow from "@/components/VerifyFlow";
import GoogleBlockedBanner from "@/components/GoogleBlockedBanner";
import Nav from "@/components/Nav";

const GOOGLE_BLOCKED = process.env.NEXT_PUBLIC_GOOGLE_BLOCKED === "true";

export default function VerifyPage() {
  if (GOOGLE_BLOCKED) {
    return (
      <main className="min-h-screen flex flex-col">
        <Nav />
        <div className="px-6 py-14">
          <GoogleBlockedBanner />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Nav />

      <div className="max-w-[560px] mx-auto px-6 py-14">
        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="font-serif text-[42px] text-fg mb-3">Get Cleared</h1>
          <p className="text-[15px] leading-[1.6] text-fg-muted max-w-[400px] mx-auto">
            Complete the steps below to receive your clearance badge. It takes less than a minute.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-4 w-full max-w-xs mx-auto text-center">
              <div className="text-fg-muted text-sm uppercase tracking-wider">
                Loading verification
              </div>
              <div className="loading-bar">
                <div className="loading-bar-inner" />
              </div>
            </div>
          }
        >
          <VerifyFlow />
        </Suspense>
      </div>
    </main>
  );
}
