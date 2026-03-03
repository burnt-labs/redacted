use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("unauthorized")]
    Unauthorized,

    #[error("invalid quote: {0}")]
    InvalidQuote(String),

    #[error("invalid signature")]
    InvalidSignature,

    #[error("not clean")]
    NotClean,

    #[error("already has badge")]
    AlreadyHasBadge,

    #[error("invalid result format")]
    InvalidResultFormat,
}
