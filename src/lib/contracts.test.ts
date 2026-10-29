import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NFT = "xion1nft";
const RECLAIM_NFT = "xion1reclaimnft";

type Contracts = typeof import("./contracts");

async function load(env: Record<string, string>): Promise<Contracts> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./contracts");
}

function queryClient(
  handler: (contract: string, msg: Record<string, any>) => unknown,
) {
  return {
    queryContractSmart: vi.fn(async (c: string, m: Record<string, any>) =>
      handler(c, m),
    ),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isContractSigningClient", () => {
  it("accepts objects with execute and queryContractSmart", async () => {
    const { isContractSigningClient } = await load({});
    expect(
      isContractSigningClient({ execute() {}, queryContractSmart() {} }),
    ).toBe(true);
  });

  it("rejects everything else", async () => {
    const { isContractSigningClient } = await load({});
    expect(isContractSigningClient(null)).toBe(false);
    expect(isContractSigningClient("client")).toBe(false);
    expect(isContractSigningClient({ execute() {} })).toBe(false);
  });
});

describe("with distinct NFT contracts", () => {
  let c: Contracts;

  beforeEach(async () => {
    c = await load({
      NEXT_PUBLIC_NFT_CONTRACT: NFT,
      NEXT_PUBLIC_RECLAIM_NFT_CONTRACT: RECLAIM_NFT,
      NEXT_PUBLIC_CLEARANCE_CONTRACT: "xion1clearance",
      NEXT_PUBLIC_RECLAIM_CLEARANCE_CONTRACT: "xion1reclaimclearance",
    });
  });

  it("sums the badge count across contracts", async () => {
    const q = queryClient((contract) => ({
      count: contract === NFT ? 2 : undefined,
    }));
    await expect(c.getBadgeCount(q)).resolves.toBe(2);
    expect(q.queryContractSmart).toHaveBeenCalledTimes(2);
  });

  it("reports clearance when any contract holds a token", async () => {
    const q = queryClient((contract) => ({
      tokens: contract === RECLAIM_NFT ? ["t"] : [],
    }));
    await expect(c.isCleared(q, "xion1me")).resolves.toBe(true);
  });

  it("reports no clearance when no contract holds a token", async () => {
    const q = queryClient(() => ({}));
    await expect(c.isCleared(q, "xion1me")).resolves.toBe(false);
  });

  it("attributes a badge to the contract that holds it", async () => {
    const oauth = queryClient((contract) => ({
      tokens: contract === NFT ? ["1"] : [],
    }));
    await expect(c.getUserBadge(oauth, "xion1me")).resolves.toEqual({
      tokenIds: ["1"],
      source: "oauth3",
    });
    const reclaim = queryClient((contract) => ({
      tokens: contract === RECLAIM_NFT ? ["2"] : [],
    }));
    await expect(c.getUserBadge(reclaim, "xion1me")).resolves.toEqual({
      tokenIds: ["2"],
      source: "reclaim",
    });
  });

  it("returns no badge when none is held", async () => {
    const q = queryClient(() => ({}));
    await expect(c.getUserBadge(q, "xion1me")).resolves.toEqual({
      tokenIds: [],
      source: null,
    });
  });

  it("queries nft_info for a badge", async () => {
    const q = queryClient(() => ({ extension: { name: "Badge" } }));
    await expect(c.getBadgeInfo(q, "7", NFT)).resolves.toEqual({
      extension: { name: "Badge" },
    });
    expect(q.queryContractSmart).toHaveBeenCalledWith(NFT, {
      nft_info: { token_id: "7" },
    });
  });

  it("pages through all tokens of every contract", async () => {
    const page = Array.from({ length: 100 }, (_, i) => `n${i}`);
    const q = queryClient((contract, msg) => {
      if (contract === NFT) {
        return { tokens: msg.all_tokens.start_after ? ["n100"] : page };
      }
      return {};
    });
    const all = await c.getAllBadges(q);
    expect(all).toHaveLength(101);
    expect(all[0]).toEqual({
      tokenId: "n0",
      nftContract: NFT,
      source: "oauth3",
    });
    expect(q.queryContractSmart).toHaveBeenCalledWith(NFT, {
      all_tokens: { limit: 100, start_after: "n99" },
    });
  });

  it("labels reclaim tokens and stops on an exact page boundary", async () => {
    const page = Array.from({ length: 100 }, (_, i) => `r${i}`);
    const q = queryClient((contract, msg) => {
      if (contract === RECLAIM_NFT) {
        return { tokens: msg.all_tokens.start_after ? [] : page };
      }
      return { tokens: [] };
    });
    const all = await c.getAllBadges(q);
    expect(all).toHaveLength(100);
    expect(all[0].source).toBe("reclaim");
  });

  it("submits an OAuth3 proof to the clearance contract", async () => {
    const execute = vi.fn().mockResolvedValue({ transactionHash: "h" });
    const client = { execute, queryContractSmart: vi.fn() };
    await expect(
      c.submitProof(client, "xion1me", "result", "quote"),
    ).resolves.toEqual({
      transactionHash: "h",
    });
    expect(execute).toHaveBeenCalledWith(
      "xion1me",
      "xion1clearance",
      { submit_proof: { result: "result", quote: "quote" } },
      "auto",
    );
  });

  it("submits a Reclaim proof with numeric epoch and timestamp", async () => {
    const execute = vi.fn().mockResolvedValue({ transactionHash: "h" });
    const client = { execute, queryContractSmart: vi.fn() };
    await c.submitReclaimProof(client, "xion1me", {
      claimData: {
        provider: "http",
        parameters: "{}",
        context: "{}",
        identifier: "0xabc",
        owner: "0xowner",
        epoch: "1",
        timestampS: "1700000000",
      },
      signatures: ["0xsig"],
    });
    const [, contract, msg] = execute.mock.calls[0];
    expect(contract).toBe("xion1reclaimclearance");
    expect(msg.mint_verified.token_id).toBe("reclaim-0xabc");
    expect(msg.mint_verified.signed_claim.claim).toMatchObject({
      epoch: 1,
      timestamp_s: 1700000000,
    });
  });
});

describe("with one shared NFT contract", () => {
  it("queries it once and cannot attribute a source", async () => {
    const c = await load({
      NEXT_PUBLIC_NFT_CONTRACT: NFT,
      NEXT_PUBLIC_RECLAIM_NFT_CONTRACT: NFT,
    });
    const q = queryClient((_, msg) =>
      "num_tokens" in msg ? { count: 3 } : { tokens: ["1"] },
    );
    await expect(c.getBadgeCount(q)).resolves.toBe(3);
    await expect(c.getUserBadge(q, "xion1me")).resolves.toEqual({
      tokenIds: ["1"],
      source: null,
    });
    const all = await c.getAllBadges(q);
    expect(all).toEqual([{ tokenId: "1", nftContract: NFT, source: null }]);
  });
});
