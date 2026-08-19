import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiter for oauth3/reclaim endpoints.
// On Vercel (serverless), each cold start resets the map — this provides
// best-effort protection, not a hard guarantee. For stronger guarantees,
// use Vercel KV or Upstash Redis.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_MAP_SIZE = 10_000; // Cap to prevent unbounded memory growth
const MAX_REQUESTS: Record<string, number> = {
  "/api/oauth3/verify": 5,
  "/api/oauth3/login": 10,
  "/api/oauth3/callback": 10,
  "/api/reclaim/init": 5,
};

const ALLOWED_HOSTS = [
  "theredactedfile.com",
  "www.theredactedfile.com",
  "localhost",
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.includes(hostname) || hostname.endsWith(".workers.dev");
}

function cleanupExpiredEntries() {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  });
}

function getClientIP(request: NextRequest): string {
  // On Vercel, x-forwarded-for is set by the platform and cannot be
  // spoofed by clients. On other platforms, ensure your reverse proxy
  // strips/overwrites this header.
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.ip ||
    "unknown"
  );
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Maintenance mode: redirect all page requests to /overloaded
  if (process.env.MAINTENANCE_MODE === "true") {
    const isOverloaded = pathname === "/overloaded";
    const isApi = pathname.startsWith("/api/");
    const isNextInternal = pathname.startsWith("/_next/");
    const isStaticFile = pathname.includes(".");

    if (!isOverloaded && !isApi && !isNextInternal && !isStaticFile) {
      const url = request.nextUrl.clone();
      url.pathname = "/overloaded";
      return NextResponse.redirect(url);
    }
  }

  // Origin validation on state-changing (POST) endpoints
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        if (!isAllowedHost(originHost)) {
          return NextResponse.json(
            { error: "Forbidden" },
            { status: 403 }
          );
        }
      } catch {
        // Malformed Origin header — reject
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }
  }

  const limit = MAX_REQUESTS[pathname];
  if (!limit) return NextResponse.next();

  const ip = getClientIP(request);
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    // Evict expired entries when the map grows too large
    if (rateLimitMap.size >= MAX_MAP_SIZE) {
      cleanupExpiredEntries();
    }
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return NextResponse.next();
  }

  if (entry.count >= limit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.svg).*)"],
};
