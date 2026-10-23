use anchor_lang::prelude::*;

#[constant]
pub const HUB_SEED: &[u8] = b"hub";

#[constant]
pub const ESCROW_SEED: &[u8] = b"escrow";

#[constant]
pub const COLLECTION_SEED: &[u8] = b"collection";

#[constant]
pub const PICKER_SEED: &[u8] = b"picker";

#[constant]
pub const PHOTO_SEED: &[u8] = b"photo";

#[constant]
pub const BALE_SEED: &[u8] = b"bale";

#[constant]
pub const CREDITS_SEED: &[u8] = b"credits";

#[constant]
pub const CLAIM_SEED: &[u8] = b"claim";

#[constant]
pub const MAX_CONTAMINATION_BPS: u16 = 10_000;
