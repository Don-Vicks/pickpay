use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, state::Hub};

#[derive(Accounts)]
pub struct InitHub<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Hub::INIT_SPACE,
        seeds = [HUB_SEED, authority.key().as_ref()],
        bump
    )]
    pub hub: Account<'info, Hub>,
    pub mint: Account<'info, Mint>,
    /// Payout float, owned by the hub PDA. Anyone can top it up with a plain SPL transfer.
    #[account(
        init,
        payer = authority,
        seeds = [ESCROW_SEED, hub.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = hub,
    )]
    pub escrow: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_hub(ctx: Context<InitHub>) -> Result<()> {
    ctx.accounts.hub.set_inner(Hub {
        authority: ctx.accounts.authority.key(),
        mint: ctx.accounts.mint.key(),
        escrow: ctx.accounts.escrow.key(),
        collected_g: 0,
        shipped_g: 0,
        paid_total: 0,
        owed_total: 0,
        collection_count: 0,
        bale_count: 0,
        bump: ctx.bumps.hub,
        escrow_bump: ctx.bumps.escrow,
    });
    Ok(())
}
