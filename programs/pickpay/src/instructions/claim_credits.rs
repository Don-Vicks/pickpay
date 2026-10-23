use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Claim, CreditBatch},
};

#[derive(Accounts)]
pub struct ClaimCredits<'info> {
    #[account(mut)]
    pub brand: Signer<'info>,
    #[account(mut)]
    pub credit_batch: Account<'info, CreditBatch>,
    #[account(
        init,
        payer = brand,
        space = 8 + Claim::INIT_SPACE,
        seeds = [CLAIM_SEED, credit_batch.key().as_ref(), &credit_batch.claim_count.to_le_bytes()],
        bump
    )]
    pub claim: Account<'info, Claim>,
    pub system_program: Program<'info, System>,
}

/// Retires `weight_g` of the batch's credits for the signing brand. Credits retired by anyone
/// are gone, so a second brand claiming the same kilos fails with AlreadyClaimed.
pub fn handle_claim_credits(ctx: Context<ClaimCredits>, weight_g: u64) -> Result<()> {
    require!(weight_g > 0, ErrorCode::ZeroWeight);
    let batch_key = ctx.accounts.credit_batch.key();
    let batch = &mut ctx.accounts.credit_batch;

    let claimed = batch.claimed_g.checked_add(weight_g).ok_or(ErrorCode::Overflow)?;
    require!(claimed <= batch.accepted_g, ErrorCode::AlreadyClaimed);

    let index = batch.claim_count;
    ctx.accounts.claim.set_inner(Claim {
        batch: batch_key,
        index,
        brand: ctx.accounts.brand.key(),
        weight_g,
        created_at: Clock::get()?.unix_timestamp,
    });
    batch.claimed_g = claimed;
    batch.claim_count = index.checked_add(1).ok_or(ErrorCode::Overflow)?;
    Ok(())
}
