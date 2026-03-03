/**
 * Webpack loader that patches @burnt-labs/abstraxion-core at compile time.
 * Fixes the treasury grant comparison bug where chain grants decoded to REST
 * format use @type key but the comparison code reads .typeUrl (always undefined).
 *
 * This runs during `next build`, so it works regardless of postinstall or caching.
 */

const DECODE_REST_FN = `
var decodeRestFormatAuthorization = (authorization) => {
  const typeUrl = authorization["@type"] || authorization.typeUrl;
  if (authorization.value && (typeof authorization.value === "string" || authorization.value instanceof Uint8Array || (authorization.value.length !== undefined && typeof authorization.value !== "string"))) {
    return decodeAuthorization(typeUrl, authorization.value);
  }
  switch (typeUrl) {
    case "/cosmos.authz.v1beta1.GenericAuthorization":
      return { type: "/cosmos.authz.v1beta1.GenericAuthorization", data: { msg: authorization.msg } };
    case "/cosmos.bank.v1beta1.SendAuthorization":
      return { type: "/cosmos.bank.v1beta1.SendAuthorization", data: { spendLimit: (authorization.spend_limit || []).map(coin => ({ denom: coin.denom, amount: coin.amount })), allowList: authorization.allow_list || [] } };
    case "/cosmos.staking.v1beta1.StakeAuthorization":
      return { type: "/cosmos.staking.v1beta1.StakeAuthorization", data: { authorizationType: authorization.authorization_type, maxTokens: authorization.max_tokens, allowList: authorization.allow_list || [], denyList: authorization.deny_list || [] } };
    case "/cosmwasm.wasm.v1.ContractExecutionAuthorization": {
      const grants = (authorization.grants || []).map((grant) => { const limit = grant.limit || {}; const filter = grant.filter || {}; return { address: grant.contract, limitType: limit["@type"], maxCalls: limit.calls_remaining || limit.remaining, maxFunds: limit.amounts, filterType: filter["@type"], messages: filter.messages, keys: filter.keys }; });
      return { type: "/cosmwasm.wasm.v1.ContractExecutionAuthorization", data: { grants } };
    }
    default:
      return { type: "Unsupported", data: null };
  }
};
`;

module.exports = function (source) {
  // Skip if already patched
  if (source.includes("decodeRestFormatAuthorization")) {
    return source;
  }

  let patched = source;

  // 1. Insert decodeRestFormatAuthorization function
  const marker = "// src/utils/grant/compare.ts";
  if (patched.includes(marker)) {
    patched = patched.replace(marker, DECODE_REST_FN + "\n" + marker);
  } else {
    const fallback = "function isHumanContractExecAuth";
    if (patched.includes(fallback)) {
      patched = patched.replace(fallback, DECODE_REST_FN + "\n" + fallback);
    }
  }

  // 2. Replace decodeAuthorization calls with decodeRestFormatAuthorization
  patched = patched.replace(
    /decodeAuthorization\(\s*grantResponse\.authorization\.typeUrl,\s*grantResponse\.authorization\.value\s*\)/g,
    "decodeRestFormatAuthorization(grantResponse.authorization)"
  );

  // 3. Patch getAccount for new accounts
  const getAccountCJS = /async getAccount\(searchAddress\) \{\s*const account = await this\.forceGetQueryClient\(\)\.auth\.account\(searchAddress\);\s*if \(!account\) \{\s*return null;\s*\}\s*return signers\.customAccountFromAny\(account\);\s*\}/;
  const getAccountESM = /async getAccount\(searchAddress\) \{\s*const account = await this\.forceGetQueryClient\(\)\.auth\.account\(searchAddress\);\s*if \(!account\) \{\s*return null;\s*\}\s*return customAccountFromAny\(account\);\s*\}/;

  const makeNewGetAccount = (fnName) => `async getAccount(searchAddress) {
    try {
      const account = await this.forceGetQueryClient().auth.account(searchAddress);
      if (!account) {
        if (searchAddress === this._granteeAddress) {
          return { address: searchAddress, accountNumber: 0, sequence: 0, pubkey: null };
        }
        return null;
      }
      return ${fnName}(account);
    } catch (error) {
      if (searchAddress === this._granteeAddress) {
        return { address: searchAddress, accountNumber: 0, sequence: 0, pubkey: null };
      }
      return null;
    }
  }`;

  if (getAccountCJS.test(patched)) {
    patched = patched.replace(getAccountCJS, makeNewGetAccount("signers.customAccountFromAny"));
  } else if (getAccountESM.test(patched)) {
    patched = patched.replace(getAccountESM, makeNewGetAccount("customAccountFromAny"));
  }

  if (patched !== source) {
    console.log("  [abstraxion-patch-loader] Patched abstraxion-core at compile time");
  }

  return patched;
};
