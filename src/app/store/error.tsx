"use client";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-14">
      <div className="max-w-md text-center space-y-6">
        <h1 className="font-serif text-[32px] text-fg">Store Unavailable</h1>
        <p className="text-[14px] text-fg-muted leading-[1.65]">
          We couldn&apos;t load the store. Please try again.
        </p>
        <button
          onClick={reset}
          className="font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg border-none cursor-pointer transition-all hover:bg-accent hover:text-white"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
