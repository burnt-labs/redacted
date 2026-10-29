import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./middleware");
}

function request(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest(`https://theredactedfile.com${path}`, init);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("maintenance mode", () => {
  it("redirects pages to /overloaded", async () => {
    const { middleware } = await load({ MAINTENANCE_MODE: "true" });
    const res = middleware(request("/verify"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://theredactedfile.com/overloaded",
    );
  });

  it("leaves the overloaded page, APIs, Next internals and static files alone", async () => {
    const { middleware } = await load({ MAINTENANCE_MODE: "true" });
    for (const path of [
      "/overloaded",
      "/api/other",
      "/_next/data",
      "/og-image.png",
    ]) {
      expect(middleware(request(path)).headers.get("location")).toBeNull();
    }
  });
});

describe("origin validation on POST", () => {
  it("rejects a foreign origin", async () => {
    const { middleware } = await load();
    const res = middleware(
      request("/api/other", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects a malformed origin", async () => {
    const { middleware } = await load();
    const res = middleware(
      request("/api/other", { method: "POST", headers: { origin: "::::" } }),
    );
    expect(res.status).toBe(403);
  });

  it("allows the app's own hosts and workers.dev previews", async () => {
    const { middleware } = await load();
    for (const origin of [
      "https://theredactedfile.com",
      "https://abc-redacted.burnt.workers.dev",
    ]) {
      const res = middleware(
        request("/api/other", { method: "POST", headers: { origin } }),
      );
      expect(res.status).toBe(200);
    }
  });
});

describe("rate limiting", () => {
  it("allows up to the limit per IP and path, then returns 429", async () => {
    const { middleware } = await load();
    const hit = () =>
      middleware(
        request("/api/oauth3/verify", {
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
        }),
      );
    for (let i = 0; i < 5; i++) expect(hit().status).toBe(200);
    expect(hit().status).toBe(429);
  });

  it("keys by x-real-ip when x-forwarded-for is absent", async () => {
    const { middleware } = await load();
    const hit = (ip: string) =>
      middleware(
        request("/api/reclaim/init", {
          method: "POST",
          headers: { "x-real-ip": ip },
        }),
      );
    for (let i = 0; i < 5; i++) hit("198.51.100.1");
    expect(hit("198.51.100.1").status).toBe(429);
    expect(hit("198.51.100.2").status).toBe(200);
  });

  it("starts a new window once the old one expires", async () => {
    vi.useFakeTimers();
    try {
      const { middleware } = await load();
      const hit = () => middleware(request("/api/oauth3/login"));
      for (let i = 0; i < 10; i++) hit();
      expect(hit().status).toBe(429);
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      expect(hit().status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not limit paths without a limit", async () => {
    const { middleware } = await load();
    for (let i = 0; i < 20; i++)
      expect(middleware(request("/gallery")).status).toBe(200);
  });
});
