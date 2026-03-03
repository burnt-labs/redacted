import Link from "next/link";

export default function GoogleBlockedBanner() {
  return (
    <div className="w-full max-w-[560px] mx-auto">
      {/* Certificate frame */}
      <div className="relative border border-border p-8 sm:p-12">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent" />

        {/* Classified label */}
        <div className="text-center mb-8">
          <span className="font-mono text-[10px] font-bold tracking-[0.25em] uppercase text-accent border border-accent px-3 py-1">
            Classified Notice
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-[36px] sm:text-[42px] text-fg text-center leading-[1.1] mb-6">
          Google Shut<br />Us Down
        </h1>

        {/* Body copy */}
        <div className="space-y-4 text-[14px] leading-[1.7] text-fg-muted text-center mb-10">
          <p>
            Google revoked API access to an application that lets people prove they never emailed Jeffrey Epstein.
          </p>
          <p>
            Draw your own conclusions.
          </p>
        </div>

        {/* Redaction bar divider */}
        <div className="flex justify-center gap-1.5 mb-10 opacity-20">
          <div className="bg-redact rounded-sm h-2" style={{ width: 60 }} />
          <div className="bg-redact rounded-sm h-2" style={{ width: 100 }} />
          <div className="bg-redact rounded-sm h-2" style={{ width: 40 }} />
        </div>

        {/* Support section */}
        <div className="text-center space-y-4">
          <div className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-fg">
            Support the Mission
          </div>
          <p className="text-[14px] leading-[1.7] text-fg-muted max-w-[380px] mx-auto">
            You don&apos;t need clearance to support victims of trafficking and abuse. The store is now open to everyone.
          </p>
          <Link
            href="/store"
            className="inline-block font-mono text-[13px] font-bold tracking-[0.18em] uppercase bg-fg text-bg px-8 sm:px-12 py-4 no-underline transition-all hover:bg-accent hover:text-white"
          >
            Buy a Shirt
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-fg-light text-center mt-6">
        All proceeds go directly to supporting victims through the Asiyah Women&apos;s Center.
      </p>
    </div>
  );
}
