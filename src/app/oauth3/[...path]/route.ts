import { NextRequest, NextResponse } from "next/server";

/**
 * Reverse-proxy for the CVM (Confidential Virtual Machine) OAuth flow.
 *
 * Why this exists instead of a Next.js rewrite:
 *   OpenNext/Cloudflare Workers uses `fetch()` which follows redirects by
 *   default.  When the CVM responds with a 302 → accounts.google.com, the
 *   rewrite follows that redirect server-side and serves Google's sign-in
 *   HTML under theredactedfile.com — breaking CSP, CORS, and CSP-reports.
 *
 *   This route uses `redirect: "manual"` so the CVM's 302 is forwarded to
 *   the browser as-is.  The browser then navigates to Google at Google's
 *   own origin and everything works correctly.
 *
 *   Cookies set by the CVM on the initial /auth/google request are scoped
 *   to theredactedfile.com (because that's the origin the browser sees).
 *   When Google redirects back to theredactedfile.com/oauth3/auth/callback/…,
 *   the browser includes those cookies, and we forward them to the CVM.
 */

const OAUTH3_BASE_URL = process.env.OAUTH3_BASE_URL;

const ALLOWED_OAUTH3_HOSTS = ["theredactedfile.com", "phala.network", "burnt.com"];

// Hop-by-hop headers that must not be forwarded between hops.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  "host",
]);

function isAllowedCvmUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_OAUTH3_HOSTS.some(
      (host) =>
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

async function proxyToCvm(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  if (!OAUTH3_BASE_URL || !isAllowedCvmUrl(OAUTH3_BASE_URL)) {
    return NextResponse.json(
      { error: "OAuth3 proxy is not configured" },
      { status: 503 },
    );
  }

  const targetPath = pathSegments.join("/");
  const url = new URL(`/${targetPath}`, OAUTH3_BASE_URL);
  url.search = request.nextUrl.search;

  // Forward client headers, excluding hop-by-hop.
  const fwdHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      fwdHeaders.set(key, value);
    }
  });

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: request.method,
      headers: fwdHeaders,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
      // Critical: do NOT follow redirects — forward them to the browser.
      redirect: "manual",
    });
  } catch (e) {
    console.error(
      "CVM proxy error:",
      e instanceof Error ? e.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Failed to connect to OAuth3 instance" },
      { status: 502 },
    );
  }

  // Build response headers, excluding hop-by-hop.
  const resHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return; // handled below
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      resHeaders.set(key, value);
    }
  });

  // Forward Set-Cookie headers individually (they must not be combined).
  const setCookies =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : [];
  for (const cookie of setCookies) {
    resHeaders.append("set-cookie", cookie);
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyToCvm(request, params.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return proxyToCvm(request, params.path);
}
