import { NextRequest, NextResponse } from "next/server";

// Redirect through the /oauth3 reverse-proxy to start Google auth.
// The proxy forwards requests to the CVM with `redirect: "manual"`,
// so the CVM's 302 → Google is forwarded as-is to the browser.
//
// Cookies (CSRF state, session) are set on theredactedfile.com by
// the proxy — no tokens ever appear in URLs.

export async function GET(request: NextRequest) {
  const returnTo = encodeURIComponent("/api/oauth3/callback");
  const authUrl = `${request.nextUrl.origin}/oauth3/auth/google?return_to=${returnTo}`;
  return NextResponse.redirect(authUrl);
}
