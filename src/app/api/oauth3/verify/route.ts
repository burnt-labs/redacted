import { NextRequest, NextResponse } from "next/server";

const OAUTH3_BASE_URL = process.env.OAUTH3_BASE_URL;

export async function POST(request: NextRequest) {
  if (!OAUTH3_BASE_URL) {
    return NextResponse.json(
      { error: "OAuth3 is not configured" },
      { status: 503 }
    );
  }

  // Read the OAuth3 session token from our localhost cookie
  const token = request.cookies.get("oauth3_token")?.value;
  if (!token) {
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
    // The CVM should revoke the Google OAuth token immediately after
    // completing the Gmail search (POST https://oauth2.googleapis.com/revoke).
    const res = await fetch(`${OAUTH3_BASE_URL}/verify/gmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
    const response = NextResponse.json(data);

    // Delete the OAuth3 token — match all attributes from when it was set
    response.cookies.set("oauth3_token", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    console.error("OAuth3 verify error:", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to connect to OAuth3 instance" },
      { status: 502 }
    );
  }
}
