import { NextResponse } from "next/server";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";

const RECLAIM_APP_ID = process.env.RECLAIM_APP_ID!;
const RECLAIM_APP_SECRET = process.env.RECLAIM_APP_SECRET!;
const RECLAIM_PROVIDER_ID = process.env.RECLAIM_PROVIDER_ID!;

export async function POST() {
  if (!RECLAIM_APP_ID || !RECLAIM_APP_SECRET || !RECLAIM_PROVIDER_ID) {
    return NextResponse.json(
      { error: "Reclaim is not configured" },
      { status: 503 }
    );
  }

  try {
    const proofRequest = await ReclaimProofRequest.init(
      RECLAIM_APP_ID,
      RECLAIM_APP_SECRET,
      RECLAIM_PROVIDER_ID,
      {
        customSharePageUrl: "https://portal.reclaimprotocol.org/kernel",
        useAppClip: false,
      }
    );
    proofRequest.setParams({ senderEmail: "jeevacation@gmail.com" });

    const requestUrl = await proofRequest.getRequestUrl();
    const jsonString = proofRequest.toJsonString();

    return NextResponse.json({ requestUrl, reclaimJson: jsonString });
  } catch (e) {
    console.error("Reclaim init error:", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to initialize verification session" },
      { status: 500 }
    );
  }
}
