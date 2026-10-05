import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const reclaim = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@reclaimprotocol/js-sdk", () => ({
  ReclaimProofRequest: { init: reclaim.init },
}));

const ADDRESS = "xion1" + "a".repeat(40);

function stubEnv(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

function post(path: string, body: string, cookie?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(`https://theredactedfile.com${path}`, {
    method: "POST",
    body,
    headers,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  reclaim.init.mockReset();
});

describe("GET /api/oauth3/login", () => {
  it("redirects through the /oauth3 proxy with the callback as return_to", async () => {
    const { GET } = await import("./oauth3/login/route");
    const res = await GET(
      new NextRequest("https://theredactedfile.com/api/oauth3/login"),
    );
    expect(res.headers.get("location")).toBe(
      "https://theredactedfile.com/oauth3/auth/google?return_to=%2Fapi%2Foauth3%2Fcallback",
    );
  });
});

describe("GET /api/oauth3/callback", () => {
  it("returns a locked-down page that posts back to its own origin", async () => {
    const { GET } = await import("./oauth3/callback/route");
    const res = await GET(
      new NextRequest("https://theredactedfile.com/api/oauth3/callback"),
    );
    expect(res.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    const html = await res.text();
    expect(html).toContain('"https://theredactedfile.com"');
    expect(html).toContain("oauth3:authenticated");
  });
});

describe("POST /api/oauth3/verify", () => {
  const load = async (
    env: Record<string, string> = {
      OAUTH3_BASE_URL: "https://oauth3.burnt.com",
    },
  ) => {
    stubEnv(env);
    return import("./oauth3/verify/route");
  };

  it("returns 503 when OAuth3 is not configured", async () => {
    const { POST } = await load({ OAUTH3_BASE_URL: "" });
    const res = await POST(post("/api/oauth3/verify", "{}", "sid=s"));
    expect(res.status).toBe(503);
  });

  it("requires the session cookie", async () => {
    const { POST } = await load();
    expect((await POST(post("/api/oauth3/verify", "{}"))).status).toBe(401);
  });

  it("validates the body and address", async () => {
    const { POST } = await load();
    expect(
      (await POST(post("/api/oauth3/verify", "not json", "sid=s"))).status,
    ).toBe(400);
    expect((await POST(post("/api/oauth3/verify", "{}", "sid=s"))).status).toBe(
      400,
    );
    const bad = await POST(
      post(
        "/api/oauth3/verify",
        JSON.stringify({ address: "cosmos1x" }),
        "sid=s",
      ),
    );
    expect(bad.status).toBe(400);
  });

  it("forwards the session to the CVM and returns its attestation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: "r", quote: "q" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await POST(
      post(
        "/api/oauth3/verify",
        JSON.stringify({ address: ADDRESS }),
        "sid=s1",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "r", quote: "q" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth3.burnt.com/verify/gmail");
    expect(init.headers.Cookie).toBe("sid=s1");
  });

  it("maps CVM failures to 502", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await load();
    const body = JSON.stringify({ address: ADDRESS });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("no", { status: 500 })),
    );
    expect((await POST(post("/api/oauth3/verify", body, "sid=s"))).status).toBe(
      502,
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect((await POST(post("/api/oauth3/verify", body, "sid=s"))).status).toBe(
      502,
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("down"));
    expect((await POST(post("/api/oauth3/verify", body, "sid=s"))).status).toBe(
      502,
    );
  });
});

describe("POST /api/reclaim/init", () => {
  const configured = {
    RECLAIM_APP_ID: "app",
    RECLAIM_APP_SECRET: "secret",
    RECLAIM_PROVIDER_ID: "provider",
  };

  it("returns 503 when Reclaim is not configured", async () => {
    stubEnv({
      RECLAIM_APP_ID: "",
      RECLAIM_APP_SECRET: "",
      RECLAIM_PROVIDER_ID: "",
    });
    const { POST } = await import("./reclaim/init/route");
    expect((await POST()).status).toBe(503);
  });

  it("returns the request URL and serialized session", async () => {
    const setParams = vi.fn();
    reclaim.init.mockResolvedValue({
      setParams,
      getRequestUrl: async () => "https://reclaim.example/req",
      toJsonString: () => "{}",
    });
    stubEnv(configured);
    const { POST } = await import("./reclaim/init/route");
    const res = await POST();
    expect(await res.json()).toEqual({
      requestUrl: "https://reclaim.example/req",
      reclaimJson: "{}",
    });
    expect(reclaim.init).toHaveBeenCalledWith(
      "app",
      "secret",
      "provider",
      expect.any(Object),
    );
    expect(setParams).toHaveBeenCalledWith({
      senderEmail: "jeevacation@gmail.com",
    });
  });

  it("returns 500 when the SDK fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubEnv(configured);
    const { POST } = await import("./reclaim/init/route");
    reclaim.init.mockRejectedValueOnce(new Error("boom"));
    expect((await POST()).status).toBe(500);
    reclaim.init.mockRejectedValueOnce("boom");
    expect((await POST()).status).toBe(500);
  });
});
