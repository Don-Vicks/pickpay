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
pub const MAX_CONTAMINATION_BPS: u16 = 10_000;
