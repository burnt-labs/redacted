use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Binary};
use cw_storage_plus::Item;

#[cw_serde]
pub struct Config {
    pub admin: Addr,
    pub nft_contract: Addr,
    pub tee_pubkey: Binary, // 64 bytes: raw x||y of P-256 attestation key
}

/// Old config format (before TDX verification was added) for migration
#[cw_serde]
pub struct OldConfig {
    pub admin: Addr,
    pub nft_contract: Addr,
}

pub const CONFIG: Item<Config> = Item::new("config");
/// Same storage key as CONFIG, used only during migration to read old format
pub const OLD_CONFIG: Item<OldConfig> = Item::new("config");
pub const BADGE_COUNT: Item<u64> = Item::new("badge_count");
