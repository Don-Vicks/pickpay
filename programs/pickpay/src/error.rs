use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Weight must be greater than zero")]
    ZeroWeight,
    #[msg("Contamination must be between 0 and 10000 basis points")]
    ContaminationOutOfRange,
    #[msg("Bale weight exceeds the hub's unshipped collected weight")]
    ExceedsCollected,
    #[msg("Accepted weight exceeds the bale weight")]
    ExceedsIntake,
    #[msg("These credits have already been claimed")]
    AlreadyClaimed,
    #[msg("Picker token account is missing or uses the wrong mint")]
    WrongMint,
    #[msg("Only the bale's named recycler can confirm intake")]
    WrongRecycler,
    #[msg("Arithmetic overflow")]
    Overflow,
}
