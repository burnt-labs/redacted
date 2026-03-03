import { NextRequest, NextResponse } from "next/server";

// Alphanumeric + common token chars (JWT dots, base64 slashes, etc.), max 2048
const TOKEN_PATTERN = /^[a-zA-Z0-9._\-~+/=]{1,2048}$/;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";

  // Reject malformed tokens before storing as cookie
  if (token && !TOKEN_PATTERN.test(token)) {
    return NextResponse.json(
      { error: "Invalid token format" },
      { status: 400 }
    );
  }

  // This page runs inside a popup window opened by VerifyFlow.
  // After OAuth3 login, we store the session token in a cookie on localhost
  // and notify the parent window via postMessage.
  const origin = request.nextUrl.origin;
  const html = `<!DOCTYPE html>
<html><head><title>Authenticated</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "oauth3:authenticated" }, ${JSON.stringify(origin)});
    window.close();
  } else {
    // Fallback: if opened directly (not as popup), redirect to verify page
    window.location.href = "/verify?oauth3=authenticated";
  }
</script>
<p>Authenticated. You can close this window.</p>
</body></html>`;

  const response = new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'",
    },
  });

  // Store the OAuth3 session token in an httpOnly cookie on localhost
  if (token) {
    response.cookies.set("oauth3_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600, // 10 minutes (matches token expiry)
    });
  }

  return response;
}
