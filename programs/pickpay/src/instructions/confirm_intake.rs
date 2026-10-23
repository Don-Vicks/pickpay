use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Bale, CreditBatch},
};

#[derive(Accounts)]
pub struct ConfirmIntake<'info> {
    #[account(mut)]
    pub recycler: Signer<'info>,
    #[account(mut, has_one = recycler @ ErrorCode::WrongRecycler)]
    pub bale: Account<'info, Bale>,
    /// One batch per bale, so intake can only be confirmed once.
    #[account(
        init,
        payer = recycler,
        space = 8 + CreditBatch::INIT_SPACE,
        seeds = [CREDITS_SEED, bale.key().as_ref()],
        bump
    )]
    pub credit_batch: Account<'info, CreditBatch>,
    pub system_program: Program<'info, System>,
}

pub fn handle_confirm_intake(ctx: Context<ConfirmIntake>, accepted_g: u64) -> Result<()> {
    require!(accepted_g > 0, ErrorCode::ZeroWeight);
    let bale = &mut ctx.accounts.bale;
    require!(accepted_g <= bale.weight_g, ErrorCode::ExceedsIntake);

    bale.intake_confirmed = true;
    ctx.accounts.credit_batch.set_inner(CreditBatch {
        bale: bale.key(),
        recycler: ctx.accounts.recycler.key(),
        accepted_g,
        claimed_g: 0,
        claim_count: 0,
        created_at: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
