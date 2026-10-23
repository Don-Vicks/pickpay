use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Bale, Hub},
};

#[derive(Accounts)]
pub struct ShipBale<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [HUB_SEED, authority.key().as_ref()],
        bump = hub.bump,
        has_one = authority,
    )]
    pub hub: Account<'info, Hub>,
    #[account(
        init,
        payer = authority,
        space = 8 + Bale::INIT_SPACE,
        seeds = [BALE_SEED, hub.key().as_ref(), &hub.bale_count.to_le_bytes()],
        bump
    )]
    pub bale: Account<'info, Bale>,
    pub system_program: Program<'info, System>,
}

pub fn handle_ship_bale(ctx: Context<ShipBale>, weight_g: u64, recycler: Pubkey) -> Result<()> {
    require!(weight_g > 0, ErrorCode::ZeroWeight);
    let hub_key = ctx.accounts.hub.key();
    let hub = &mut ctx.accounts.hub;

    let shipped = hub.shipped_g.checked_add(weight_g).ok_or(ErrorCode::Overflow)?;
    require!(shipped <= hub.collected_g, ErrorCode::ExceedsCollected);

    let index = hub.bale_count;
    ctx.accounts.bale.set_inner(Bale {
        hub: hub_key,
        index,
        recycler,
        weight_g,
        first_collection: hub.next_unbaled,
        end_collection: hub.collection_count,
        intake_confirmed: false,
        created_at: Clock::get()?.unix_timestamp,
    });
    hub.shipped_g = shipped;
    hub.next_unbaled = hub.collection_count;
    hub.bale_count = index.checked_add(1).ok_or(ErrorCode::Overflow)?;
    Ok(())
}
