"use client";
import { Suspense } from "react";
import BadgeContent from "./BadgeContent";
import Nav from "@/components/Nav";

export default function BadgePage({
  params,
}: {
  params: { address: string };
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav />

      <div className="max-w-[560px] sm:max-w-[640px] mx-auto px-6 py-14 w-full">
        <Suspense
          fallback={
            <div className="space-y-4 w-full max-w-xs mx-auto text-center">
              <div className="text-fg-muted text-sm uppercase tracking-wider">
                Retrieving clearance record
              </div>
              <div className="loading-bar">
                <div className="loading-bar-inner" />
              </div>
            </div>
          }
        >
          <BadgeContent address={params.address} />
        </Suspense>
      </div>
    </main>
  );
}
