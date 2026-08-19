import { NextRequest, NextResponse } from "next/server";

const OAUTH3_BASE_URL = process.env.OAUTH3_BASE_URL;

export async function POST(request: NextRequest) {
  if (!OAUTH3_BASE_URL) {
    return NextResponse.json(
      { error: "OAuth3 is not configured" },
      { status: 503 }
    );
  }

  // The CVM's session cookie (`sid`) was set on this domain by the
  // /oauth3 reverse proxy during Google auth.  Forward it to the CVM
  // so the SessionUser extractor can authenticate the request.
  const sid = request.cookies.get("sid")?.value;
  if (!sid) {
    return NextResponse.json(
      { error: "Not authenticated with OAuth3. Please sign in first." },
      { status: 401 }
    );
  }

  let address: string | undefined;
  try {
    const body = await request.json();
    address = body.address;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter" },
      { status: 400 }
    );
  }

  if (!/^xion1[a-z0-9]{38,58}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  try {
    // Single call to OAuth3's TEE-attested verification endpoint.
    // The CVM revokes the Google OAuth token immediately after
    // completing the Gmail search and unlinks the identity.
    const res = await fetch(`${OAUTH3_BASE_URL}/verify/gmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `sid=${sid}`,
      },
      body: JSON.stringify({ address, suspect: "jeevacation@gmail.com" }),
    });

    if (!res.ok) {
      // Log status only — don't leak CVM response body to logs
      console.error("CVM verification failed:", res.status);
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 502 }
      );
    }

    const data = await res.json(); // { result: "<json string>", quote: "<base64>" }
    return NextResponse.json(data);
  } catch (e) {
    console.error("OAuth3 verify error:", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to connect to OAuth3 instance" },
      { status: 502 }
    );
  }
}
