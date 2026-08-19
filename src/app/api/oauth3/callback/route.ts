import { NextRequest, NextResponse } from "next/server";

// After Google auth the CVM redirects here.
// The CVM's `sid` session cookie is already set on this domain
// (via the /oauth3 reverse proxy), so no token handling is needed.
//
// Desktop: this page runs inside a popup — notify the parent via
// postMessage and close.
// Mobile: no popup, so redirect to /verify with a UI signal.

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const html = `<!DOCTYPE html>
<html><head><title>Authenticated</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "oauth3:authenticated" }, ${JSON.stringify(origin)});
    window.close();
  } else {
    window.location.href = "/verify?oauth3=authenticated";
  }
</script>
<p>Authenticated. You can close this window.</p>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'",
    },
  });
}
