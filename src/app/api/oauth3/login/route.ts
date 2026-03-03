import { NextRequest, NextResponse } from "next/server";

// The OAuth flow goes through the /oauth3 proxy route so that the CVM's
// session cookie is set on the same origin Google redirects back to.
// The proxy uses `redirect: "manual"` to avoid serving Google's HTML
// under our domain (which would break CSP / CORS).
const PROD_URL = "https://theredactedfile.com";

export async function GET(request: NextRequest) {
  const host = request.nextUrl.hostname;

  // For local dev, use the actual origin so the callback reaches localhost.
  // In production (and any other environment), always use PROD_URL to ensure
  // the CVM cookie round-trips correctly on the canonical domain.
  const callbackOrigin = host === "localhost"
    ? request.nextUrl.origin
    : PROD_URL;

  const returnTo = encodeURIComponent(`${callbackOrigin}/api/oauth3/callback`);
  const authUrl = `${PROD_URL}/oauth3/auth/google?return_to=${returnTo}`;
  return NextResponse.redirect(authUrl);
}
