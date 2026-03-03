// Duck-typed interfaces to avoid version mismatches between @cosmjs packages
interface QueryClient {
  queryContractSmart(address: string, queryMsg: Record<string, unknown>): Promise<any>;
}

interface SigningClient extends QueryClient {
  execute(
    senderAddress: string,
    contractAddress: string,
    msg: Record<string, unknown>,
    fee: "auto" | number,
  ): Promise<{ transactionHash: string }>;
}

// Contract addresses from env
export const CLEARANCE_CONTRACT = process.env.NEXT_PUBLIC_CLEARANCE_CONTRACT || "";
export const NFT_CONTRACT = process.env.NEXT_PUBLIC_NFT_CONTRACT || "";
export const RECLAIM_CLEARANCE_CONTRACT = process.env.NEXT_PUBLIC_RECLAIM_CLEARANCE_CONTRACT || "";
export const RECLAIM_NFT_CONTRACT = process.env.NEXT_PUBLIC_RECLAIM_NFT_CONTRACT || "";

// Deduplicated NFT contracts — both env vars may point to the same address
const uniqueNftContracts = Array.from(new Set([NFT_CONTRACT, RECLAIM_NFT_CONTRACT].filter(Boolean)));

// ── Query functions ──

export async function getBadgeCount(queryClient: QueryClient): Promise<number> {
  let total = 0;
  for (const contract of uniqueNftContracts) {
    const res = await queryClient.queryContractSmart(contract, { num_tokens: {} });
    total += res.count ?? 0;
  }
  return total;
}

export async function isCleared(queryClient: QueryClient, address: string): Promise<boolean> {
  for (const contract of uniqueNftContracts) {
    const res = await queryClient.queryContractSmart(contract, {
      tokens: { owner: address, limit: 1 },
    });
    if (res.tokens && res.tokens.length > 0) return true;
  }
  return false;
}

export async function getUserBadge(
  queryClient: QueryClient,
  address: string
): Promise<{ tokenIds: string[]; source: "oauth3" | "reclaim" | null }> {
  // Check each unique NFT contract
  for (const contract of uniqueNftContracts) {
    const res = await queryClient.queryContractSmart(contract, {
      tokens: { owner: address, limit: 10 },
    });
    if (res.tokens && res.tokens.length > 0) {
      // Determine source based on which contract matched
      let source: "oauth3" | "reclaim" | null = null;
      if (contract === RECLAIM_NFT_CONTRACT && contract !== NFT_CONTRACT) {
        source = "reclaim";
      } else if (contract === NFT_CONTRACT && contract !== RECLAIM_NFT_CONTRACT) {
        source = "oauth3";
      }
      return { tokenIds: res.tokens, source };
    }
  }
  return { tokenIds: [], source: null };
}

export async function getBadgeInfo(
  queryClient: QueryClient,
  tokenId: string,
  nftContract: string
): Promise<{ extension?: { name?: string; description?: string; attributes?: Array<{ trait_type: string; value: string }> } }> {
  return queryClient.queryContractSmart(nftContract, {
    nft_info: { token_id: tokenId },
  });
}

export async function getAllBadges(
  queryClient: QueryClient
): Promise<Array<{ tokenId: string; nftContract: string; source: "oauth3" | "reclaim" | null }>> {
  const results: Array<{ tokenId: string; nftContract: string; source: "oauth3" | "reclaim" | null }> = [];

  for (const contract of uniqueNftContracts) {
    let startAfter: string | undefined;
    const source: "oauth3" | "reclaim" | null =
      contract === RECLAIM_NFT_CONTRACT && contract !== NFT_CONTRACT
        ? "reclaim"
        : contract === NFT_CONTRACT && contract !== RECLAIM_NFT_CONTRACT
          ? "oauth3"
          : null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const query: { all_tokens: { limit: number; start_after?: string } } = {
        all_tokens: { limit: 100 },
      };
      if (startAfter) query.all_tokens.start_after = startAfter;

      const res = await queryClient.queryContractSmart(contract, query);
      const tokens: string[] = res.tokens ?? [];
      if (tokens.length === 0) break;

      for (const tokenId of tokens) {
        results.push({ tokenId, nftContract: contract, source });
      }

      if (tokens.length < 100) break;
      startAfter = tokens[tokens.length - 1];
    }
  }

  return results;
}

// ── Execute functions ──

export async function submitProof(
  client: SigningClient,
  sender: string,
  result: string,
  quote: string
) {
  return client.execute(
    sender,
    CLEARANCE_CONTRACT,
    { submit_proof: { result, quote } },
    "auto"
  );
}

export async function submitReclaimProof(
  client: SigningClient,
  sender: string,
  proof: {
    claimData: {
      provider: string;
      parameters: string;
      context: string;
      identifier: string;
      owner: string;
      epoch: string;
      timestampS: string;
    };
    signatures: string[];
  }
) {
  const tokenId = `reclaim-${proof.claimData.identifier}`;
  return client.execute(
    sender,
    RECLAIM_CLEARANCE_CONTRACT,
    {
      mint_verified: {
        claim_info: {
          provider: proof.claimData.provider,
          parameters: proof.claimData.parameters,
          context: proof.claimData.context,
        },
        signed_claim: {
          claim: {
            identifier: proof.claimData.identifier,
            owner: proof.claimData.owner,
            epoch: Number(proof.claimData.epoch),
            timestamp_s: Number(proof.claimData.timestampS),
          },
          signatures: proof.signatures,
        },
        token_id: tokenId,
        extension: {
          name: "Epstein Files Clearance Badge (zkTLS)",
          description: "Clearance badge issued via Reclaim zkTLS verification",
          attributes: [
            { trait_type: "verification_method", value: "reclaim_zktls" },
            { trait_type: "provider", value: proof.claimData.provider },
          ],
        },
      },
    },
    "auto"
  );
}
