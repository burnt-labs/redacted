import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function load(base: string) {
  vi.resetModules();
  vi.stubEnv("OAUTH3_BASE_URL", base);
  return import("./route");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/oauth3 reverse proxy", () => {
  it("refuses when the CVM origin is missing or not allowlisted", async () => {
    for (const base of ["", "https://evil.example", "not a url"]) {
      const { GET } = await load(base);
      const res = await GET(
        new NextRequest("https://theredactedfile.com/oauth3/x"),
        {
          params: { path: ["x"] },
        },
      );
      expect(res.status).toBe(503);
    }
  });

  it("forwards redirects unfollowed, strips hop-by-hop headers and keeps each cookie", async () => {
    const upstream = new Response(null, {
      status: 302,
      headers: [
        ["location", "https://accounts.google.com/o/oauth2"],
        ["connection", "keep-alive"],
        ["set-cookie", "a=1; Path=/"],
        ["set-cookie", "b=2; Path=/"],
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await load("https://oauth3.burnt.com");

    const res = await GET(
      new NextRequest(
        "https://theredactedfile.com/oauth3/auth/google?return_to=%2Fx",
        {
          headers: { cookie: "sid=s", connection: "close" },
        },
      ),
      { params: { path: ["auth", "google"] } },
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth3.burnt.com/auth/google?return_to=%2Fx");
    expect(init.redirect).toBe("manual");
    expect(init.body).toBeUndefined();
    expect(init.headers.get("cookie")).toBe("sid=s");
    expect(init.headers.get("connection")).toBeNull();

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2",
    );
    expect(res.headers.get("connection")).toBeNull();
    expect(res.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });

  it("forwards POST bodies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load("https://oauth3.burnt.com");
    const res = await POST(
      new NextRequest("https://theredactedfile.com/oauth3/verify", {
        method: "POST",
        body: "{}",
      }),
      { params: { path: ["verify"] } },
    );
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][1].body).toBeTruthy();
  });

  it("returns 502 when the CVM is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await load("https://oauth3.burnt.com");
    const req = () => new NextRequest("https://theredactedfile.com/oauth3/x");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect((await GET(req(), { params: { path: ["x"] } })).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("down"));
    expect((await GET(req(), { params: { path: ["x"] } })).status).toBe(502);
  });
});
