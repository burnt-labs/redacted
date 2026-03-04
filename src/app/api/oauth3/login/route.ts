import { NextRequest, NextResponse } from "next/server";

// The OAuth flow goes through the /oauth3 proxy route so that the CVM's
// session cookie is set on the same origin Google redirects back to.
// The proxy uses `redirect: "manual"` to avoid serving Google's HTML
// under our domain (which would break CSP / CORS).
const PROD_URL = "https://theredactedfile.com";

export async function GET(request: NextRequest) {
  const host = request.nextUrl.hostname;

  // For local dev and Cloudflare Workers preview deployments, use the actual
  // request origin so the callback and proxy route resolve to the right host.
  // In production, use PROD_URL for the canonical domain.
  const isPreview = host === "localhost" || host.endsWith(".workers.dev");
  const origin = isPreview ? request.nextUrl.origin : PROD_URL;

  const returnTo = encodeURIComponent(`${origin}/api/oauth3/callback`);
  const authUrl = `${origin}/oauth3/auth/google?return_to=${returnTo}`;
  return NextResponse.redirect(authUrl);
}
