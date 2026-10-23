use anchor_lang::prelude::*;

// Weights are in grams; amounts are in the payout mint's base units.
// Invariant across the program: collected_g >= shipped_g >= credited_g >= claimed_g.

/// A collection hub. Its PDA owns the payout escrow.
#[account]
#[derive(InitSpace)]
pub struct Hub {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub escrow: Pubkey,
    pub collected_g: u64,
    pub shipped_g: u64,
    pub paid_total: u64,
    pub owed_total: u64,
    pub collection_count: u64,
    pub bale_count: u64,
    /// First collection index not yet assigned to a bale.
    pub next_unbaled: u64,
    pub bump: u8,
    pub escrow_bump: u8,
}

/// One weighed, graded, paid bag.
#[account]
#[derive(InitSpace)]
pub struct Collection {
    pub hub: Pubkey,
    pub index: u64,
    /// Salted hash of the picker's phone number; the number never goes on-chain.
    pub picker_hash: [u8; 32],
    /// Wallet that received the payout, or Pubkey::default() when it accrued to the picker's claim balance.
    pub paid_to: Pubkey,
    pub weight_g: u64,
    pub polymer: Polymer,
    /// Contamination estimate in basis points (0..=10_000).
    pub contamination_bps: u16,
    pub amount: u64,
    pub photo_hash: [u8; 32],
    pub created_at: i64,
}

/// A picker known only by phone hash. Holds payouts owed to pickers without a wallet.
#[account]
#[derive(InitSpace)]
pub struct Picker {
    pub picker_hash: [u8; 32],
    pub collections: u64,
    pub weight_g: u64,
    pub paid: u64,
    pub owed: u64,
    pub bump: u8,
}

/// Exists once per photo hash, so one photo can never back two collections.
#[account]
#[derive(InitSpace)]
pub struct PhotoSeal {
    pub collection: Pubkey,
}

/// Weight shipped from a hub to a recycler. Holds the bags recorded since the previous bale,
/// collections [first_collection, end_collection); the range is empty when it ships leftover weight.
#[account]
#[derive(InitSpace)]
pub struct Bale {
    pub hub: Pubkey,
    pub index: u64,
    pub recycler: Pubkey,
    pub weight_g: u64,
    pub first_collection: u64,
    pub end_collection: u64,
    pub intake_confirmed: bool,
    pub created_at: i64,
}

/// Recovery credits created by a recycler's intake confirmation; never more than the bale weight.
#[account]
#[derive(InitSpace)]
pub struct CreditBatch {
    pub bale: Pubkey,
    pub recycler: Pubkey,
    pub accepted_g: u64,
    pub claimed_g: u64,
    pub claim_count: u64,
    pub created_at: i64,
}

/// A brand retiring credits against its EPR target. Retired credits can't be claimed again.
#[account]
#[derive(InitSpace)]
pub struct Claim {
    pub batch: Pubkey,
    pub index: u64,
    pub brand: Pubkey,
    pub weight_g: u64,
    pub created_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Polymer {
    Pet,
    Hdpe,
    Mixed,
}
