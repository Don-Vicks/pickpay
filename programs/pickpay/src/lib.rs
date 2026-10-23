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
}
