"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion";
import { submitProof, submitReclaimProof, isCleared } from "@/lib/contracts";
import { useRouter, useSearchParams } from "next/navigation";

type VerifyStep =
  | "idle"
  | "connecting"
  | "choosing"
  | "redirecting"
  | "proving"
  | "verifying"
  | "submitting"
  | "success"
  | "error";

type VerifyMethod = "oauth3" | "reclaim" | null;

interface ReclaimProof {
  claimData: {
    provider: string;
    parameters: string;
    context: string;
    identifier: string;
    owner: string;
    epoch: string;
    timestampS: string;
  };
  signatures: string[];
}

const ENABLE_OAUTH3 = process.env.NEXT_PUBLIC_ENABLE_OAUTH3 === "true";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function getStepStates(step: VerifyStep, isConnected: boolean) {
  // Returns [step1, step2, step3] each as 'active' | 'done' | 'inactive'
  if (step === "success") return ["done", "done", "done"] as const;
  if (step === "submitting") return ["done", "done", "active"] as const;
  if (step === "verifying") return ["done", "active", "inactive"] as const;
  if (step === "redirecting" || step === "proving") return ["done", "active", "inactive"] as const;
  if (step === "choosing") return ["done", "active", "inactive"] as const;
  if (step === "connecting") return ["active", "inactive", "inactive"] as const;
  if (step === "error") return ["done", "active", "inactive"] as const;
  // idle
  if (isConnected) return ["done", "active", "inactive"] as const;
  return ["active", "inactive", "inactive"] as const;
}

function getProgressState(step: VerifyStep, isConnected: boolean) {
  const states = getStepStates(step, isConnected);
  const dots = states.map((s) => s === "done" || s === "active");
  const segs = [states[0] === "done", states[1] === "done"];
  return { dots, segs };
}

function WalkthroughSteps() {
  return (
    <div className="grid grid-cols-2 gap-4 max-[500px]:grid-cols-1">
      {/* Step 1: Click Advanced */}
      <div className="flex flex-col items-center">
        <div className="w-full border border-border rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="px-4 pt-5 pb-4 text-left">
            {/* Google logo */}
            <svg className="mb-3" width="52" height="18" viewBox="0 0 272 92" fill="none">
              <path d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#EA4335"/>
              <path d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#FBBC05"/>
              <path d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z" fill="#4285F4"/>
              <path d="M225 3v65h-9.5V3h9.5z" fill="#34A853"/>
              <path d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.96 0-11.84 4.37-11.59 12.93z" fill="#EA4335"/>
              <path d="M35.29 41.19V32H68c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 33.91S16.32-1.54 36.3-1.54c11.01 0 18.82 4.21 24.69 9.83l-6.95 6.95c-4.21-3.94-9.91-7.03-17.74-7.03-14.49 0-25.82 11.68-25.82 25.69 0 14.02 11.33 25.69 25.82 25.69 9.41 0 14.78-3.78 18.23-7.22 2.79-2.79 4.62-6.79 5.34-12.24H35.29z" fill="#4285F4"/>
            </svg>
            <div className="text-[11px] font-medium text-[#202124] mb-1.5 leading-snug">Google hasn&apos;t verified this app</div>
            <div className="text-[8px] text-[#5f6368] leading-relaxed mb-3">The app is requesting access to your Google Account. For your safety, don&apos;t continue until the developer has been verified by Google.</div>
            {/* Back to safety button */}
            <div className="flex justify-start mb-3">
              <div className="bg-[#1a73e8] text-white text-[8px] font-medium px-3 py-1 rounded-sm">Back to safety</div>
            </div>
            {/* Advanced link with annotation */}
            <div className="relative inline-block">
              <span className="text-[8px] text-[#5f6368]">Advanced</span>
              <div className="absolute -inset-x-1.5 -inset-y-1 border-[1.5px] border-accent rounded-full pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="text-[10px] text-fg-muted mt-2.5 font-mono tracking-[0.08em] uppercase">1. Click &quot;Advanced&quot;</div>
      </div>

      {/* Step 2: Click Go to... */}
      <div className="flex flex-col items-center">
        <div className="w-full border border-border rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="px-4 pt-5 pb-4 text-left">
            {/* Google logo */}
            <svg className="mb-3" width="52" height="18" viewBox="0 0 272 92" fill="none">
              <path d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#EA4335"/>
              <path d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#FBBC05"/>
              <path d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z" fill="#4285F4"/>
              <path d="M225 3v65h-9.5V3h9.5z" fill="#34A853"/>
              <path d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.96 0-11.84 4.37-11.59 12.93z" fill="#EA4335"/>
              <path d="M35.29 41.19V32H68c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 33.91S16.32-1.54 36.3-1.54c11.01 0 18.82 4.21 24.69 9.83l-6.95 6.95c-4.21-3.94-9.91-7.03-17.74-7.03-14.49 0-25.82 11.68-25.82 25.69 0 14.02 11.33 25.69 25.82 25.69 9.41 0 14.78-3.78 18.23-7.22 2.79-2.79 4.62-6.79 5.34-12.24H35.29z" fill="#4285F4"/>
            </svg>
            <div className="text-[11px] font-medium text-[#202124] mb-1.5 leading-snug">Google hasn&apos;t verified this app</div>
            <div className="text-[8px] text-[#5f6368] leading-relaxed mb-3">This app isn&apos;t verified by Google yet. Only proceed if you know and trust the developer.</div>
            {/* Go to link with annotation */}
            <div className="relative inline-block">
              <span className="text-[8px] text-[#5f6368]">Go to theredactedfile.com (unsafe)</span>
              <div className="absolute -inset-x-1.5 -inset-y-1 border-[1.5px] border-accent rounded-full pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="text-[10px] text-fg-muted mt-2.5 font-mono tracking-[0.08em] uppercase">2. Click &quot;Go to...&quot;</div>
      </div>
    </div>
  );
}

export default function VerifyFlow() {
  const { data: account, login, logout } = useAbstraxionAccount();
  const { client } = useAbstraxionSigningClient();
  const { client: queryClient } = useAbstraxionClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<VerifyStep>("idle");
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>(null);
  const [error, setError] = useState<string>("");
  const [attestationData, setAttestationData] = useState<string>("");
  const [alreadyCleared, setAlreadyCleared] = useState(false);

  // OAuth3 state
  const [oauth3Authenticated, setOauth3Authenticated] = useState(false);
  const verifyTriggered = useRef(false);

  // Reclaim state
  const [requestUrl, setRequestUrl] = useState<string>("");
  const [showIframe, setShowIframe] = useState(false);
  const reclaimSessionId = useRef(0);

  // Interstitial modal state
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [oauthAbandoned, setOauthAbandoned] = useState(false);
  const interstitialRef = useRef<HTMLDivElement>(null);

  const isConnected = !!account?.bech32Address;

  // Close interstitial on Escape
  useEffect(() => {
    if (!showInterstitial) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInterstitial(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [showInterstitial]);

  // Focus trap inside interstitial
  useEffect(() => {
    if (!showInterstitial || !interstitialRef.current) return;
    const focusable = interstitialRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    if (focusable.length > 0) focusable[0].focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showInterstitial]);


  // Check if user already has a badge on mount
  useEffect(() => {
    if (!isConnected || !queryClient) return;
    isCleared(queryClient, account.bech32Address).then((cleared) => {
      if (cleared) {
        setAlreadyCleared(true);
        setStep("success");
        setTimeout(() => {
          router.push(`/badge/${account.bech32Address}`);
        }, 1500);
      }
    }).catch(() => {});
  }, [isConnected, queryClient, account?.bech32Address, router]);

  // Listen for postMessage from the OAuth3 popup
  useEffect(() => {
    if (!ENABLE_OAUTH3) return;
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth3:authenticated") {
        setOauth3Authenticated(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Handle mobile redirect flow: OAuth3 callback redirects back with ?oauth3=authenticated
  useEffect(() => {
    if (!ENABLE_OAUTH3) return;
    if (searchParams.get("oauth3") === "authenticated") {
      setOauth3Authenticated(true);
      setStep("redirecting");
      // Clean query param from URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  // Auto-verify once both OAuth3 and wallet are ready
  useEffect(() => {
    if (!ENABLE_OAUTH3) return;
    if (!oauth3Authenticated || !isConnected || !client) return;
    if (verifyTriggered.current) return;
    verifyTriggered.current = true;

    handleVerifyAndSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauth3Authenticated, isConnected, client]);

  const handleConnect = useCallback(async () => {
    setStep("connecting");
    setError("");
    try {
      await login();
    } catch (e) {
      setError("Failed to create account. Try again.");
      setStep("error");
    }
  }, [login]);

  const handleSelectMethod = useCallback((method: VerifyMethod) => {
    setVerifyMethod(method);
    setStep("choosing");
  }, []);

  // -- OAuth3 flow --

  const handleStartOAuth3 = useCallback(() => {
    setStep("redirecting");
    setError("");

    // On mobile, use redirect flow instead of popup (popups are blocked)
    if (isMobileDevice()) {
      window.location.href = "/api/oauth3/login";
      return;
    }

    const w = 500;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      "/api/oauth3/login",
      "oauth3-login",
      `width=${w},height=${h},left=${left},top=${top},popup=yes`
    );
    // Clear interval from message handler to avoid race with popup close detection
    const interval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(interval);
        // Small delay to allow postMessage to arrive before declaring abandoned
        setTimeout(() => {
          if (!oauth3Authenticated) {
            setOauthAbandoned(true);
            setStep("choosing");
          }
        }, 500);
      }
    }, 500);
  }, [oauth3Authenticated]);

  const handleVerifyAndSubmit = useCallback(async () => {
    setStep("verifying");
    setError("");
    try {
      const verifyRes = await fetch("/api/oauth3/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account.bech32Address }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        throw new Error(
          data.error || `Verification failed (${verifyRes.status})`
        );
      }

      const { result, quote } = await verifyRes.json();
      const parsed = JSON.parse(result);

      setAttestationData(
        `Searched for: ${parsed.suspect}\nMessages found: ${parsed.message_count}\nResult: ${parsed.clean ? "CLEAN" : "COMPROMISED"}`
      );

      if (!parsed.clean) {
        throw new Error(
          `CLEARANCE DENIED — ${parsed.message_count} email(s) from ${parsed.suspect} found in your inbox.`
        );
      }

      setStep("submitting");
      if (!client || !account?.bech32Address) {
        throw new Error("Account not connected");
      }

      const txResult = await submitProof(
        client,
        account.bech32Address,
        result,
        quote
      );
      setStep("success");

      const badgeAddress = account.bech32Address;
      const badgeParams = new URLSearchParams({
        tx: txResult.transactionHash,
        suspect: parsed.suspect,
        count: String(parsed.message_count),
        method: "oauth3",
      });
      // Navigate first, then logout — prevents unmount from killing navigation
      const badgeUrl = `/badge/${badgeAddress}?${badgeParams}`;
      setTimeout(() => {
        window.location.href = badgeUrl;
      }, 2000);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Verification failed";
      if (message.includes("already has a clearance badge")) {
        const badgeAddress = account?.bech32Address;
        setAlreadyCleared(true);
        setStep("success");
        setTimeout(() => {
          window.location.href = `/badge/${badgeAddress}`;
        }, 1500);
        return;
      }
      verifyTriggered.current = false;
      setError(message);
      setStep("error");
    }
  }, [client, account]);

  // -- Reclaim flow --

  const handleSubmitReclaimProof = useCallback(
    async (proof: ReclaimProof, sessionId: number) => {
      // Ignore callbacks from stale sessions
      if (sessionId !== reclaimSessionId.current) return;

      setShowIframe(false);
      setStep("submitting");
      setError("");
      try {
        if (!client || !account?.bech32Address) {
          throw new Error("Account not connected");
        }

        if (!proof.claimData.identifier) {
          throw new Error("Invalid proof: missing identifier");
        }

        const txResult = await submitReclaimProof(
          client,
          account.bech32Address,
          proof
        );
        setStep("success");

        const badgeAddress = account.bech32Address;
        const badgeParams = new URLSearchParams({
          tx: txResult.transactionHash,
          method: "reclaim",
        });
        // Navigate first — prevents unmount from killing navigation
        const badgeUrl = `/badge/${badgeAddress}?${badgeParams}`;
        setTimeout(() => {
          window.location.href = badgeUrl;
        }, 2000);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Transaction failed";
        if (message.includes("already has a clearance badge")) {
          const badgeAddress = account!.bech32Address;
          setAlreadyCleared(true);
          setStep("success");
          setTimeout(() => {
            window.location.href = `/badge/${badgeAddress}`;
          }, 1500);
          return;
        }
        setError(message);
        setStep("error");
      }
    },
    [client, account]
  );

  const handleStartReclaim = useCallback(async () => {
    setStep("proving");
    setError("");
    const sessionId = ++reclaimSessionId.current;
    try {
      // Initialize session server-side (secret never leaves the server)
      const initRes = await fetch("/api/reclaim/init", { method: "POST" });
      if (!initRes.ok) {
        const data = await initRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to initialize verification");
      }

      const { requestUrl: url, reclaimJson } = await initRes.json();
      if (sessionId !== reclaimSessionId.current) return;

      setRequestUrl(url);
      setShowIframe(true);

      // Reconstruct session from server-serialized state (secret is stripped)
      const { ReclaimProofRequest } = await import("@reclaimprotocol/js-sdk");
      const proofRequest = await ReclaimProofRequest.fromJsonString(reclaimJson);

      await proofRequest.startSession({
        onSuccess: (receivedProofs: unknown) => {
          const proofsArray = Array.isArray(receivedProofs)
            ? receivedProofs
            : [receivedProofs];
          if (proofsArray.length > 0 && typeof proofsArray[0] !== "string") {
            handleSubmitReclaimProof(proofsArray[0] as unknown as ReclaimProof, sessionId);
          } else {
            if (sessionId !== reclaimSessionId.current) return;
            setError("Received invalid proof data.");
            setStep("error");
            setShowIframe(false);
          }
        },
        onError: (err: Error) => {
          if (sessionId !== reclaimSessionId.current) return;
          setError(err.message || "Verification failed");
          setStep("error");
          setShowIframe(false);
        },
      });
    } catch (e) {
      if (sessionId !== reclaimSessionId.current) return;
      const message =
        e instanceof Error ? e.message : "Failed to initialize verification.";
      setError(message);
      setStep("error");
      setShowIframe(false);
    }
  }, [handleSubmitReclaimProof]);

  const stepStates = getStepStates(step, isConnected);
  const { dots, segs } = getProgressState(step, isConnected);

  const stepClass = (state: "active" | "done" | "inactive") => {
    if (state === "done") return "done";
    if (state === "active") return "active";
    return "inactive";
  };

  const circleClass = (state: "active" | "done" | "inactive") => {
    if (state === "done") return "text-cleared border-cleared";
    if (state === "active") return "text-fg border-fg";
    return "text-fg-light border-border";
  };

  const titleClass = (state: "active" | "done" | "inactive") => {
    if (state === "inactive") return "text-fg-light";
    return "text-fg";
  };

  const descClass = (state: "active" | "done" | "inactive") => {
    if (state === "inactive") return "text-fg-light";
    return "text-fg-muted";
  };

  return (
    <>
      {/* Fullscreen iframe overlay for Reclaim verification */}
      {showIframe && requestUrl && (
        <div className="reclaim-iframe-overlay">
          <button
            className="reclaim-iframe-close"
            onClick={() => {
              setShowIframe(false);
              setStep("choosing");
              reclaimSessionId.current++;
            }}
            aria-label="Close verification"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <iframe
            src={requestUrl}
            className="reclaim-iframe"
            title="Reclaim Verification"
            allow="camera; microphone"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      )}

      {/* Pre-OAuth interstitial modal */}
      {showInterstitial && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto py-6 max-[600px]:items-start max-[600px]:py-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInterstitial(false);
          }}
        >
          <div className="fixed inset-0 bg-black/55" aria-hidden="true" />
          <div
            ref={interstitialRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="interstitial-heading"
            className="relative bg-bg border-[1.5px] border-border-dark p-10 max-w-[520px] w-full max-[600px]:p-5 max-[600px]:mx-3 max-[600px]:my-auto"
          >
            {/* Corner accents */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute top-2 left-2 w-5 h-5 border-t-[1.5px] border-l-[1.5px] border-fg" />
              <div className="absolute top-2 right-2 w-5 h-5 border-t-[1.5px] border-r-[1.5px] border-fg" />
              <div className="absolute bottom-2 left-2 w-5 h-5 border-b-[1.5px] border-l-[1.5px] border-fg" />
              <div className="absolute bottom-2 right-2 w-5 h-5 border-b-[1.5px] border-r-[1.5px] border-fg" />
            </div>

            <h2 id="interstitial-heading" className="font-serif text-[28px] text-fg mb-5 max-[600px]:text-[22px] max-[600px]:mb-3">
              Before you continue
            </h2>

            <p className="text-[14px] leading-[1.65] text-fg-muted mb-4 max-[600px]:text-[13px] max-[600px]:mb-3">
              Google&apos;s going to tell you this app isn&apos;t verified. Don&apos;t worry, your proof is generated inside fully isolated secure hardware. No one ever accesses anything, including your emails or your password.
            </p>

            <p className="text-[14px] leading-[1.65] text-fg-muted mb-5 max-[600px]:text-[13px] max-[600px]:mb-3">
              Their API team hasn&apos;t approved this app yet. We have a theory about why.
            </p>

            <a
              href="https://burnt.com/the-redacted-file-how-it-works"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[14px] text-cleared no-underline mb-6 hover:underline max-[600px]:text-[13px] max-[600px]:mb-4"
            >
              Learn more &rarr;
            </a>

            <div className="border-t border-border pt-6 mb-6 max-[600px]:pt-4 max-[600px]:mb-4">
              <div className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase text-fg mb-4">
                Here&apos;s how to get through:
              </div>
              <WalkthroughSteps />
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => {
                  setShowInterstitial(false);
                  setOauthAbandoned(false);
                  handleSelectMethod("oauth3");
                  handleStartOAuth3();
                }}
                className="w-full font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg border-none cursor-pointer transition-all hover:bg-accent hover:text-white min-h-[44px]"
              >
                Continue to Google
              </button>
              <button
                onClick={() => setShowInterstitial(false)}
                className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted bg-transparent border-none cursor-pointer transition-colors hover:text-fg min-h-[44px] px-4"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        {/* Progress bar */}
        <div className="flex items-center gap-0 mb-12">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-400 ${dots[0] ? "bg-cleared" : "bg-border"}`} />
          <div className={`flex-1 h-[2px] transition-colors duration-400 ${segs[0] ? "bg-cleared" : "bg-border"}`} />
          <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-400 ${dots[1] ? "bg-cleared" : "bg-border"}`} />
          <div className={`flex-1 h-[2px] transition-colors duration-400 ${segs[1] ? "bg-cleared" : "bg-border"}`} />
          <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-400 ${dots[2] ? "bg-cleared" : "bg-border"}`} />
        </div>

        {/* Vertical stepper */}
        <div className="flex flex-col">
          {/* Step 1: Create Account */}
          <div className="relative pl-16 py-4 max-[600px]:pl-[52px] max-[600px]:py-3">
            {/* Circle */}
            <div className={`absolute left-0 top-4 w-10 h-10 flex items-center justify-center font-serif text-[18px] border-[1.5px] rounded-full transition-all duration-300 max-[600px]:w-[34px] max-[600px]:h-[34px] max-[600px]:text-[15px] max-[600px]:top-3 ${circleClass(stepStates[0])}`}>
              {stepStates[0] === "done" ? (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5L6.5 12L13 4" />
                </svg>
              ) : "01"}
            </div>
            {/* Connecting line */}
            <div className={`absolute left-[19px] top-14 bottom-[-16px] w-[1.5px] transition-colors duration-300 max-[600px]:left-4 max-[600px]:top-12 max-[600px]:bottom-[-12px] ${stepStates[0] === "done" ? "bg-cleared" : "bg-border"}`} />
            {/* Content */}
            <div className={`font-mono text-[12px] font-bold tracking-[0.15em] uppercase mb-2 ${titleClass(stepStates[0])}`}>
              Connect Your Account
            </div>
            <div className={`text-[14px] leading-[1.65] mb-5 ${descClass(stepStates[0])}`}>
              Connect your account to permanently commemorate your clearance.
            </div>
            {/* Step 1 dynamic content */}
            {!isConnected ? (
              step === "connecting" ? (
                <div>
                  <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted flex items-center gap-2">
                    Creating account...
                  </div>
                  <div className="loading-bar mt-3">
                    <div className="loading-bar-inner" />
                  </div>
                </div>
              ) : step !== "error" ? (
                <button
                  onClick={handleConnect}
                  className="font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg border-none cursor-pointer transition-all hover:bg-accent hover:text-white"
                >
                  Create Account
                </button>
              ) : null
            ) : (
              <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-cleared flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cleared" />
                Signed in
              </div>
            )}
          </div>

          {/* Step 2: Prove You're Not a Piece of Shit */}
          <div className="relative pl-16 py-4 max-[600px]:pl-[52px] max-[600px]:py-3">
            {/* Circle */}
            <div className={`absolute left-0 top-4 w-10 h-10 flex items-center justify-center font-serif text-[18px] border-[1.5px] rounded-full transition-all duration-300 max-[600px]:w-[34px] max-[600px]:h-[34px] max-[600px]:text-[15px] max-[600px]:top-3 ${circleClass(stepStates[1])}`}>
              {stepStates[1] === "done" ? (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5L6.5 12L13 4" />
                </svg>
              ) : "02"}
            </div>
            {/* Connecting line */}
            <div className={`absolute left-[19px] top-14 bottom-[-16px] w-[1.5px] transition-colors duration-300 max-[600px]:left-4 max-[600px]:top-12 max-[600px]:bottom-[-12px] ${stepStates[1] === "done" ? "bg-cleared" : "bg-border"}`} />
            {/* Content */}
            <div className={`font-mono text-[12px] font-bold tracking-[0.15em] uppercase mb-2 ${titleClass(stepStates[1])}`}>
              Prove You&apos;re Not a Piece of Shit
            </div>
            <div className={`text-[14px] leading-[1.65] mb-5 ${descClass(stepStates[1])}`}>
              Sign in with Google. Nothing ever leaves the secure hardware environment. Your proof reveals one thing: whether Jeffrey Epstein&apos;s email ever appeared in your inbox. Nothing else. Just cleared or not.
            </div>
            {/* Step 2 dynamic content */}
            {isConnected && stepStates[1] === "active" && (
              <>
                {(step === "choosing" || (step === "idle" && isConnected)) && !verifyMethod && (
                  <button
                    onClick={() => setShowInterstitial(true)}
                    className="font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg border-none cursor-pointer transition-all hover:bg-accent hover:text-white"
                  >
                    Begin Verification
                  </button>
                )}

                {ENABLE_OAUTH3 && verifyMethod === "oauth3" && (
                  <>
                    {oauthAbandoned && step === "choosing" && (
                      <div className="mt-1">
                        <div className="text-[14px] leading-[1.65] text-fg-muted mb-5">
                          Looks like you didn&apos;t finish signing in. Google shows a warning because this app isn&apos;t verified yet. Here&apos;s how to get through:
                        </div>
                        <WalkthroughSteps />
                        <div className="flex flex-col items-center gap-3 mt-6">
                          <button
                            onClick={() => {
                              setOauthAbandoned(false);
                              setShowInterstitial(true);
                            }}
                            className="w-full font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 bg-fg text-bg border-none cursor-pointer transition-all hover:bg-accent hover:text-white"
                          >
                            Try Again
                          </button>
                          <a
                            href="mailto:redacted@burnt.com"
                            className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted no-underline transition-colors hover:text-fg"
                          >
                            Having trouble? Contact us
                          </a>
                        </div>
                      </div>
                    )}

                    {oauth3Authenticated &&
                      step !== "verifying" &&
                      step !== "submitting" &&
                      step !== "success" && (
                        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-cleared flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-cleared" />
                          Google connected
                        </div>
                      )}
                    {step === "redirecting" && !oauth3Authenticated && (
                      <div>
                        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted">
                          Signing in with Google...
                        </div>
                        <div className="loading-bar mt-3">
                          <div className="loading-bar-inner" />
                        </div>
                      </div>
                    )}
                    {step === "verifying" && (
                      <div>
                        <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted">
                          Scanning inbox...
                        </div>
                        <div className="loading-bar mt-3">
                          <div className="loading-bar-inner" />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {verifyMethod === "reclaim" && step === "proving" && (
                  <div>
                    <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted">
                      Verification in progress...
                    </div>
                    <div className="loading-bar mt-3">
                      <div className="loading-bar-inner" />
                    </div>
                  </div>
                )}
              </>
            )}
            {stepStates[1] === "done" && (
              <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-cleared flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cleared" />
                Clean
              </div>
            )}
          </div>

          {/* Step 3: Support Victims */}
          <div className="relative pl-16 py-4 max-[600px]:pl-[52px] max-[600px]:py-3">
            {/* Circle */}
            <div className={`absolute left-0 top-4 w-10 h-10 flex items-center justify-center font-serif text-[18px] border-[1.5px] rounded-full transition-all duration-300 max-[600px]:w-[34px] max-[600px]:h-[34px] max-[600px]:text-[15px] max-[600px]:top-3 ${circleClass(stepStates[2])}`}>
              {stepStates[2] === "done" ? (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5L6.5 12L13 4" />
                </svg>
              ) : "03"}
            </div>
            {/* Content */}
            <div className={`font-mono text-[12px] font-bold tracking-[0.15em] uppercase mb-2 ${titleClass(stepStates[2])}`}>
              Wear the Proof
            </div>
            <div className={`text-[14px] leading-[1.65] mb-5 ${descClass(stepStates[2])}`}>
              Cleared? Grab a tshirt that only verified people can buy. All proceeds go to victims.
            </div>
            {/* Step 3 dynamic content */}
            {step === "submitting" && (
              <div>
                <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted">
                  Recording on chain...
                </div>
                <div className="loading-bar mt-3">
                  <div className="loading-bar-inner" />
                </div>
              </div>
            )}
            {step === "success" && (
              <div>
                <div className="font-mono text-[13px] font-bold tracking-[0.2em] uppercase text-cleared">
                  {alreadyCleared ? "Already Cleared" : "Clearance Granted"}
                </div>
                <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-fg-muted mt-2">
                  {alreadyCleared
                    ? "Redirecting to your badge..."
                    : "Redirecting to your badge..."}
                </div>
                <div className="loading-bar mt-3">
                  <div className="loading-bar-inner" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error display */}
        {step === "error" && error && (
          <div className="mt-8 border border-accent/50 p-6">
            <div className="font-mono text-[12px] font-bold tracking-[0.15em] uppercase text-accent mb-2">
              Verification Failed
            </div>
            <p className="text-[14px] text-fg-muted break-words">{error}</p>
            <button
              onClick={() => {
                setStep("idle");
                setVerifyMethod(null);
                verifyTriggered.current = false;
              }}
              className="mt-4 font-mono text-[12px] font-bold tracking-[0.15em] uppercase px-8 py-3.5 border-[1.5px] border-fg text-fg bg-transparent cursor-pointer transition-all hover:bg-fg hover:text-bg"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </>
  );
}
