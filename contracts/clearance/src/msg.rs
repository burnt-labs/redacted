use cosmwasm_schema::cw_serde;
use serde::{Deserialize, Serialize};

#[cw_serde]
pub struct InstantiateMsg {
    pub admin: String,
    pub nft_contract: String,
    pub tee_pubkey: String,
}

#[cw_serde]
pub enum ExecuteMsg {
    SubmitProof { result: String, quote: String },
    SetTeePubkey { pubkey: String },
    UpdateConfig { admin: Option<String>, nft_contract: Option<String> },
}

#[cw_serde]
pub enum QueryMsg {
    GetConfig {},
    GetBadgeCount {},
    GetTeePubkey {},
}

#[cw_serde]
pub struct MigrateMsg {
    pub tee_pubkey: String,
}

#[cw_serde]
pub struct ConfigResponse {
    pub admin: String,
    pub nft_contract: String,
}

#[cw_serde]
pub struct BadgeCountResponse {
    pub count: u64,
}

#[cw_serde]
pub struct TeePubkeyResponse {
    pub pubkey: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VerificationResult {
    pub address: String,
    pub clean: bool,
    pub message_count: u64,
    pub suspect: String,
    pub timestamp: u64,
}

#[cw_serde]
pub enum Cw721ExecuteMsg {
    Mint {
        token_id: String,
        owner: String,
        token_uri: Option<String>,
        extension: Option<serde_json::Value>,
    },
}

#[cw_serde]
pub enum Cw721QueryMsg {
    Tokens {
        owner: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
}

#[cw_serde]
pub struct TokensResponse {
    pub tokens: Vec<String>,
}
