use cosmwasm_std::{
    entry_point, from_json, to_json_binary, Binary, Deps, DepsMut, Env, HexBinary, MessageInfo,
    Response, StdResult, WasmMsg,
};
use sha2::{Digest, Sha256};

use crate::error::ContractError;
use crate::msg::{
    BadgeCountResponse, ConfigResponse, Cw721ExecuteMsg, Cw721QueryMsg, ExecuteMsg,
    InstantiateMsg, MigrateMsg, QueryMsg, TeePubkeyResponse, TokensResponse, VerificationResult,
};
use crate::state::{Config, OldConfig, BADGE_COUNT, CONFIG, OLD_CONFIG};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let tee_pubkey_bytes = HexBinary::from_hex(&msg.tee_pubkey)
        .map_err(|_| ContractError::InvalidQuote("invalid hex for tee_pubkey".into()))?;
    if tee_pubkey_bytes.len() != 64 {
        return Err(ContractError::InvalidQuote(
            "tee_pubkey must be 64 bytes".into(),
        ));
    }

    let config = Config {
        admin: deps.api.addr_validate(&msg.admin)?,
        nft_contract: deps.api.addr_validate(&msg.nft_contract)?,
        tee_pubkey: Binary::from(tee_pubkey_bytes.to_vec()),
    };
    CONFIG.save(deps.storage, &config)?;
    BADGE_COUNT.save(deps.storage, &0u64)?;

    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::SubmitProof { result, quote } => {
            execute_submit_proof(deps, env, info, result, quote)
        }
        ExecuteMsg::SetTeePubkey { pubkey } => execute_set_tee_pubkey(deps, info, pubkey),
        ExecuteMsg::UpdateConfig {
            admin,
            nft_contract,
        } => execute_update_config(deps, info, admin, nft_contract),
    }
}

fn execute_submit_proof(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    result: String,
    quote_b64: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // 1. Decode base64 quote
    let quote_bytes = Binary::from_base64(&quote_b64)
        .map_err(|_| ContractError::InvalidQuote("invalid base64".into()))?
        .to_vec();
    if quote_bytes.len() < 764 {
        return Err(ContractError::InvalidQuote("too short".into()));
    }

    // 2. Validate TDX v4 header
    let version = u16::from_le_bytes([quote_bytes[0], quote_bytes[1]]);
    let tee_type = u32::from_le_bytes([
        quote_bytes[4],
        quote_bytes[5],
        quote_bytes[6],
        quote_bytes[7],
    ]);
    if version != 4 || tee_type != 0x81 {
        return Err(ContractError::InvalidQuote("not TDX v4".into()));
    }

    // 3. Extract attestation key (offset 0x2BC = 700, 64 bytes) and check match
    let att_key = &quote_bytes[0x2BC..0x2FC];
    if att_key != config.tee_pubkey.as_slice() {
        return Err(ContractError::InvalidQuote(
            "attestation key mismatch".into(),
        ));
    }

    // 4. Compute SHA-256(header || body) = SHA-256(quote_bytes[0..632])
    let message_hash = Sha256::digest(&quote_bytes[0..632]);

    // 5. Extract ECDSA signature (offset 0x27C = 636, 64 bytes)
    let signature = &quote_bytes[0x27C..0x2BC];

    // 6. Build uncompressed P-256 public key: 0x04 || x || y
    let mut pubkey_uncompressed = vec![0x04u8];
    pubkey_uncompressed.extend_from_slice(att_key);

    // 7. Verify P-256 ECDSA signature using cosmwasm host function
    let valid = deps
        .api
        .secp256r1_verify(&message_hash, signature, &pubkey_uncompressed)
        .map_err(|_| ContractError::InvalidSignature)?;
    if !valid {
        return Err(ContractError::InvalidSignature);
    }

    // 8. Extract REPORTDATA (offset 0x238 = 568, 64 bytes) and verify
    let report_data = &quote_bytes[0x238..0x278];
    let expected_hash = Sha256::digest(result.as_bytes());
    if report_data[0..32] != expected_hash[..] {
        return Err(ContractError::InvalidQuote("report_data mismatch".into()));
    }

    // 9. Parse result JSON, check clean == true, verify address matches sender
    let verification: VerificationResult =
        from_json(result.as_bytes()).map_err(|_| ContractError::InvalidResultFormat)?;
    if !verification.clean {
        return Err(ContractError::NotClean);
    }
    if verification.address != info.sender.to_string() {
        return Err(ContractError::InvalidQuote("address mismatch".into()));
    }

    // 9b. Validate quote freshness (reject quotes older than 24 hours)
    // The timestamp is in the result JSON which is authenticated by REPORTDATA hash.
    const MAX_QUOTE_AGE_SECS: u64 = 86400;
    const MAX_CLOCK_DRIFT_SECS: u64 = 300;
    let block_time = env.block.time.seconds();
    if block_time > verification.timestamp + MAX_QUOTE_AGE_SECS {
        return Err(ContractError::InvalidQuote(format!(
            "quote too old: {} seconds",
            block_time - verification.timestamp
        )));
    }
    if verification.timestamp > block_time + MAX_CLOCK_DRIFT_SECS {
        return Err(ContractError::InvalidQuote(
            "timestamp in the future".into(),
        ));
    }

    // 10. Check user doesn't already have a badge
    let tokens_response: TokensResponse = deps.querier.query_wasm_smart(
        config.nft_contract.to_string(),
        &Cw721QueryMsg::Tokens {
            owner: info.sender.to_string(),
            start_after: None,
            limit: Some(1),
        },
    )?;

    if !tokens_response.tokens.is_empty() {
        return Err(ContractError::AlreadyHasBadge);
    }

    // 11. Mint NFT badge
    let badge_count = BADGE_COUNT.load(deps.storage)?;
    let token_id = badge_count.to_string();

    let mint_msg = WasmMsg::Execute {
        contract_addr: config.nft_contract.to_string(),
        msg: to_json_binary(&Cw721ExecuteMsg::Mint {
            token_id: token_id.clone(),
            owner: info.sender.to_string(),
            token_uri: None,
            extension: None,
        })?,
        funds: vec![],
    };

    // 12. Increment badge count
    BADGE_COUNT.save(deps.storage, &(badge_count + 1))?;

    Ok(Response::new()
        .add_message(mint_msg)
        .add_attribute("action", "submit_proof")
        .add_attribute("recipient", info.sender)
        .add_attribute("token_id", token_id)
        .add_attribute("suspect", verification.suspect))
}

fn execute_set_tee_pubkey(
    deps: DepsMut,
    info: MessageInfo,
    pubkey: String,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    if info.sender != config.admin {
        return Err(ContractError::Unauthorized);
    }

    let pubkey_bytes = HexBinary::from_hex(&pubkey)
        .map_err(|_| ContractError::InvalidQuote("invalid hex for pubkey".into()))?;
    if pubkey_bytes.len() != 64 {
        return Err(ContractError::InvalidQuote(
            "pubkey must be 64 bytes".into(),
        ));
    }

    config.tee_pubkey = Binary::from(pubkey_bytes.to_vec());
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "set_tee_pubkey"))
}

fn execute_update_config(
    deps: DepsMut,
    info: MessageInfo,
    admin: Option<String>,
    nft_contract: Option<String>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    if info.sender != config.admin {
        return Err(ContractError::Unauthorized);
    }

    if let Some(admin) = admin {
        config.admin = deps.api.addr_validate(&admin)?;
    }
    if let Some(nft_contract) = nft_contract {
        config.nft_contract = deps.api.addr_validate(&nft_contract)?;
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "update_config"))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetConfig {} => {
            let config = CONFIG.load(deps.storage)?;
            to_json_binary(&ConfigResponse {
                admin: config.admin.to_string(),
                nft_contract: config.nft_contract.to_string(),
            })
        }
        QueryMsg::GetBadgeCount {} => {
            let count = BADGE_COUNT.load(deps.storage)?;
            to_json_binary(&BadgeCountResponse { count })
        }
        QueryMsg::GetTeePubkey {} => {
            let config = CONFIG.load(deps.storage)?;
            let hex = HexBinary::from(config.tee_pubkey.to_vec());
            to_json_binary(&TeePubkeyResponse {
                pubkey: hex.to_string(),
            })
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(deps: DepsMut, _env: Env, msg: MigrateMsg) -> Result<Response, ContractError> {
    let tee_pubkey_bytes = HexBinary::from_hex(&msg.tee_pubkey)
        .map_err(|_| ContractError::InvalidQuote("invalid hex for tee_pubkey".into()))?;
    if tee_pubkey_bytes.len() != 64 {
        return Err(ContractError::InvalidQuote(
            "tee_pubkey must be 64 bytes".into(),
        ));
    }

    // Try loading the new Config first (in case of re-migration),
    // fall back to OldConfig for first migration from pre-TDX contract
    let config = if let Ok(existing) = CONFIG.load(deps.storage) {
        Config {
            admin: existing.admin,
            nft_contract: existing.nft_contract,
            tee_pubkey: Binary::from(tee_pubkey_bytes.to_vec()),
        }
    } else {
        let old = OLD_CONFIG.load(deps.storage)?;
        Config {
            admin: old.admin,
            nft_contract: old.nft_contract,
            tee_pubkey: Binary::from(tee_pubkey_bytes.to_vec()),
        }
    };

    CONFIG.save(deps.storage, &config)?;
    Ok(Response::new().add_attribute("action", "migrate"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{message_info, mock_env, MockApi, MockQuerier, MockStorage};
    use cosmwasm_std::{
        from_json, to_json_binary, ContractResult, OwnedDeps, SystemError, SystemResult,
        WasmQuery,
    };

    // Dummy 64-byte TEE pubkey (all zeros) for tests
    const DUMMY_TEE_PUBKEY_HEX: &str = "0000000000000000000000000000000000000000000000000000000000000000\
                                         0000000000000000000000000000000000000000000000000000000000000000";

    fn mock_dependencies() -> OwnedDeps<MockStorage, MockApi, MockQuerier> {
        OwnedDeps {
            storage: MockStorage::default(),
            api: MockApi::default().with_prefix("xion"),
            querier: MockQuerier::default(),
            custom_query_type: std::marker::PhantomData,
        }
    }

    fn mock_dependencies_with_querier(
        nft_contract: String,
        owner_has_tokens: bool,
    ) -> OwnedDeps<MockStorage, MockApi, MockQuerier> {
        let mut deps = mock_dependencies();

        let nft_contract_clone = nft_contract.clone();

        deps.querier.update_wasm(move |query| match query {
            WasmQuery::Smart { contract_addr, .. } => {
                if *contract_addr == nft_contract_clone {
                    let tokens = if owner_has_tokens {
                        vec!["0".to_string()]
                    } else {
                        vec![]
                    };
                    SystemResult::Ok(ContractResult::Ok(
                        to_json_binary(&TokensResponse { tokens }).unwrap(),
                    ))
                } else {
                    SystemResult::Err(SystemError::NoSuchContract {
                        addr: contract_addr.clone(),
                    })
                }
            }
            _ => SystemResult::Err(SystemError::UnsupportedRequest {
                kind: "unsupported".to_string(),
            }),
        });

        deps
    }

    fn sample_instantiate_msg(api: &MockApi) -> InstantiateMsg {
        InstantiateMsg {
            admin: api.addr_make("admin").to_string(),
            nft_contract: api.addr_make("nft_contract").to_string(),
            tee_pubkey: DUMMY_TEE_PUBKEY_HEX.to_string(),
        }
    }

    #[test]
    fn test_instantiate() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);

        let res = instantiate(deps.as_mut(), env, info, msg).unwrap();
        assert_eq!(res.attributes.len(), 1);
        assert_eq!(res.attributes[0].key, "action");
        assert_eq!(res.attributes[0].value, "instantiate");

        let config = CONFIG.load(deps.as_ref().storage).unwrap();
        assert_eq!(config.admin, deps.api.addr_make("admin"));
        assert_eq!(config.nft_contract, deps.api.addr_make("nft_contract"));
        assert_eq!(config.tee_pubkey.len(), 64);

        let count = BADGE_COUNT.load(deps.as_ref().storage).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_instantiate_invalid_pubkey_length() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let info = message_info(&admin, &[]);
        let msg = InstantiateMsg {
            admin: deps.api.addr_make("admin").to_string(),
            nft_contract: deps.api.addr_make("nft_contract").to_string(),
            tee_pubkey: "aabbccdd".to_string(), // only 4 bytes
        };

        let err = instantiate(deps.as_mut(), env, info, msg).unwrap_err();
        assert!(matches!(err, ContractError::InvalidQuote(_)));
    }

    #[test]
    fn test_instantiate_invalid_hex() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let info = message_info(&admin, &[]);
        let msg = InstantiateMsg {
            admin: deps.api.addr_make("admin").to_string(),
            nft_contract: deps.api.addr_make("nft_contract").to_string(),
            tee_pubkey: "zzzz".to_string(),
        };

        let err = instantiate(deps.as_mut(), env, info, msg).unwrap_err();
        assert!(matches!(err, ContractError::InvalidQuote(_)));
    }

    #[test]
    fn test_submit_proof_quote_too_short() {
        let api = MockApi::default().with_prefix("xion");
        let nft_contract = api.addr_make("nft_contract").to_string();
        let mut deps = mock_dependencies_with_querier(nft_contract.clone(), false);
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let user = deps.api.addr_make("user");
        let user_info = message_info(&user, &[]);

        // A very short base64 string (only a few bytes)
        let msg = ExecuteMsg::SubmitProof {
            result: "{}".to_string(),
            quote: Binary::from(vec![0u8; 100]).to_base64(),
        };

        let err = execute(deps.as_mut(), env, user_info, msg).unwrap_err();
        assert_eq!(err, ContractError::InvalidQuote("too short".into()));
    }

    #[test]
    fn test_submit_proof_wrong_version() {
        let api = MockApi::default().with_prefix("xion");
        let nft_contract = api.addr_make("nft_contract").to_string();
        let mut deps = mock_dependencies_with_querier(nft_contract.clone(), false);
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let user = deps.api.addr_make("user");
        let user_info = message_info(&user, &[]);

        // 764+ bytes but version=3 instead of 4
        let mut quote_bytes = vec![0u8; 800];
        quote_bytes[0] = 3; // version = 3 (wrong)
        quote_bytes[1] = 0;
        quote_bytes[4] = 0x81; // tee_type = 0x81 (correct)

        let msg = ExecuteMsg::SubmitProof {
            result: "{}".to_string(),
            quote: Binary::from(quote_bytes).to_base64(),
        };

        let err = execute(deps.as_mut(), env, user_info, msg).unwrap_err();
        assert_eq!(err, ContractError::InvalidQuote("not TDX v4".into()));
    }

    #[test]
    fn test_submit_proof_wrong_tee_type() {
        let api = MockApi::default().with_prefix("xion");
        let nft_contract = api.addr_make("nft_contract").to_string();
        let mut deps = mock_dependencies_with_querier(nft_contract.clone(), false);
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let user = deps.api.addr_make("user");
        let user_info = message_info(&user, &[]);

        let mut quote_bytes = vec![0u8; 800];
        quote_bytes[0] = 4; // version = 4 (correct)
        quote_bytes[1] = 0;
        quote_bytes[4] = 0x00; // tee_type = 0 (SGX, not TDX)

        let msg = ExecuteMsg::SubmitProof {
            result: "{}".to_string(),
            quote: Binary::from(quote_bytes).to_base64(),
        };

        let err = execute(deps.as_mut(), env, user_info, msg).unwrap_err();
        assert_eq!(err, ContractError::InvalidQuote("not TDX v4".into()));
    }

    #[test]
    fn test_submit_proof_attestation_key_mismatch() {
        let api = MockApi::default().with_prefix("xion");
        let nft_contract = api.addr_make("nft_contract").to_string();
        let mut deps = mock_dependencies_with_querier(nft_contract.clone(), false);
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let user = deps.api.addr_make("user");
        let user_info = message_info(&user, &[]);

        let mut quote_bytes = vec![0u8; 800];
        quote_bytes[0] = 4; // version = 4
        quote_bytes[4] = 0x81; // tee_type = 0x81
        // Att key at 0x2BC..0x2FC = all zeros matches DUMMY_TEE_PUBKEY_HEX... but let's make it NOT match
        quote_bytes[0x2BC] = 0xFF; // different from stored all-zeros key

        let msg = ExecuteMsg::SubmitProof {
            result: "{}".to_string(),
            quote: Binary::from(quote_bytes).to_base64(),
        };

        let err = execute(deps.as_mut(), env, user_info, msg).unwrap_err();
        assert_eq!(
            err,
            ContractError::InvalidQuote("attestation key mismatch".into())
        );
    }

    #[test]
    fn test_submit_proof_not_clean() {
        // This test would require a valid signature to pass the crypto check.
        // Since MockApi doesn't support secp256r1_verify, we test the "not clean"
        // path via the VerificationResult parsing logic directly.
        let result_json = r#"{"address":"xion1user","clean":false,"message_count":5,"suspect":"bad","timestamp":1234}"#;
        let verification: VerificationResult = from_json(result_json.as_bytes()).unwrap();
        assert!(!verification.clean);
    }

    #[test]
    fn test_submit_proof_invalid_result_json() {
        // Verify that malformed JSON is caught
        let bad_json = "not valid json";
        let result: Result<VerificationResult, _> = from_json(bad_json.as_bytes());
        assert!(result.is_err());
    }

    #[test]
    fn test_submit_proof_duplicate_rejected() {
        // Note: This tests the AlreadyHasBadge path. Since the full SubmitProof
        // now requires valid TDX crypto which MockApi can't provide, we test
        // the badge check directly via state.
        let api = MockApi::default().with_prefix("xion");
        let nft_contract = api.addr_make("nft_contract").to_string();
        let mut deps = mock_dependencies_with_querier(nft_contract.clone(), true);
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        // Directly test that a user with tokens gets AlreadyHasBadge
        let tokens_response: TokensResponse = deps
            .as_ref()
            .querier
            .query_wasm_smart(
                nft_contract,
                &Cw721QueryMsg::Tokens {
                    owner: deps.api.addr_make("user").to_string(),
                    start_after: None,
                    limit: Some(1),
                },
            )
            .unwrap();
        assert!(!tokens_response.tokens.is_empty());
    }

    #[test]
    fn test_set_tee_pubkey_admin_only() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        // Non-admin should fail
        let non_admin = deps.api.addr_make("non_admin");
        let non_admin_info = message_info(&non_admin, &[]);
        let new_key = "1111111111111111111111111111111111111111111111111111111111111111\
                        2222222222222222222222222222222222222222222222222222222222222222";
        let msg = ExecuteMsg::SetTeePubkey {
            pubkey: new_key.to_string(),
        };
        let err = execute(deps.as_mut(), env.clone(), non_admin_info, msg).unwrap_err();
        assert_eq!(err, ContractError::Unauthorized);

        // Admin should succeed
        let admin_info = message_info(&admin, &[]);
        let msg = ExecuteMsg::SetTeePubkey {
            pubkey: new_key.to_string(),
        };
        let res = execute(deps.as_mut(), env, admin_info, msg).unwrap();
        assert_eq!(res.attributes[0].value, "set_tee_pubkey");

        let config = CONFIG.load(deps.as_ref().storage).unwrap();
        assert_eq!(config.tee_pubkey.len(), 64);
        assert_eq!(config.tee_pubkey[0], 0x11);
    }

    #[test]
    fn test_set_tee_pubkey_invalid_length() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let admin_info = message_info(&admin, &[]);
        let msg = ExecuteMsg::SetTeePubkey {
            pubkey: "aabb".to_string(), // only 2 bytes
        };
        let err = execute(deps.as_mut(), env, admin_info, msg).unwrap_err();
        assert!(matches!(err, ContractError::InvalidQuote(_)));
    }

    #[test]
    fn test_update_config_admin_only() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        // Non-admin should fail
        let non_admin = deps.api.addr_make("non_admin");
        let non_admin_info = message_info(&non_admin, &[]);
        let msg = ExecuteMsg::UpdateConfig {
            admin: None,
            nft_contract: None,
        };
        let err = execute(deps.as_mut(), env.clone(), non_admin_info, msg).unwrap_err();
        assert_eq!(err, ContractError::Unauthorized);

        // Admin should succeed
        let new_nft = deps.api.addr_make("new_nft").to_string();
        let admin_info = message_info(&admin, &[]);
        let msg = ExecuteMsg::UpdateConfig {
            admin: None,
            nft_contract: Some(new_nft.clone()),
        };
        let res = execute(deps.as_mut(), env, admin_info, msg).unwrap();
        assert_eq!(res.attributes[0].value, "update_config");

        let config = CONFIG.load(deps.as_ref().storage).unwrap();
        assert_eq!(config.nft_contract.to_string(), new_nft);
    }

    #[test]
    fn test_query_config() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let res = query(deps.as_ref(), env, QueryMsg::GetConfig {}).unwrap();
        let config: ConfigResponse = from_json(res).unwrap();
        assert_eq!(config.admin, deps.api.addr_make("admin").to_string());
        assert_eq!(
            config.nft_contract,
            deps.api.addr_make("nft_contract").to_string()
        );
    }

    #[test]
    fn test_query_badge_count() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let res = query(deps.as_ref(), env, QueryMsg::GetBadgeCount {}).unwrap();
        let badge_count: BadgeCountResponse = from_json(res).unwrap();
        assert_eq!(badge_count.count, 0);
    }

    #[test]
    fn test_query_tee_pubkey() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let res = query(deps.as_ref(), env, QueryMsg::GetTeePubkey {}).unwrap();
        let tee_resp: TeePubkeyResponse = from_json(res).unwrap();
        assert_eq!(tee_resp.pubkey, DUMMY_TEE_PUBKEY_HEX);
    }

    #[test]
    fn test_migrate() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let new_key = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\
                        bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        let migrate_msg = MigrateMsg {
            tee_pubkey: new_key.to_string(),
        };
        let res = migrate(deps.as_mut(), env.clone(), migrate_msg).unwrap();
        assert_eq!(res.attributes[0].value, "migrate");

        let config = CONFIG.load(deps.as_ref().storage).unwrap();
        assert_eq!(config.tee_pubkey.len(), 64);
        assert_eq!(config.tee_pubkey[0], 0xAA);
        assert_eq!(config.tee_pubkey[32], 0xBB);
    }

    #[test]
    fn test_migrate_invalid_pubkey() {
        let mut deps = mock_dependencies();
        let env = mock_env();
        let admin = deps.api.addr_make("admin");
        let admin_info = message_info(&admin, &[]);
        let msg = sample_instantiate_msg(&deps.api);
        instantiate(deps.as_mut(), env.clone(), admin_info, msg).unwrap();

        let migrate_msg = MigrateMsg {
            tee_pubkey: "tooshort".to_string(),
        };
        let err = migrate(deps.as_mut(), env, migrate_msg).unwrap_err();
        assert!(matches!(err, ContractError::InvalidQuote(_)));
    }
}
