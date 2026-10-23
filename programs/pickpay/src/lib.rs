pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz");

#[program]
pub mod pickpay {
    use super::*;

    pub fn init_hub(ctx: Context<InitHub>) -> Result<()> {
        crate::instructions::init_hub::handle_init_hub(ctx)
    }

    pub fn record_collection(ctx: Context<RecordCollection>, args: RecordCollectionArgs) -> Result<()> {
        crate::instructions::record_collection::handle_record_collection(ctx, args)
    }

    pub fn ship_bale(ctx: Context<ShipBale>, weight_g: u64, recycler: Pubkey) -> Result<()> {
        crate::instructions::ship_bale::handle_ship_bale(ctx, weight_g, recycler)
    }

    pub fn confirm_intake(ctx: Context<ConfirmIntake>, accepted_g: u64) -> Result<()> {
        crate::instructions::confirm_intake::handle_confirm_intake(ctx, accepted_g)
    }

    pub fn claim_credits(ctx: Context<ClaimCredits>, weight_g: u64) -> Result<()> {
        crate::instructions::claim_credits::handle_claim_credits(ctx, weight_g)
    }
}
