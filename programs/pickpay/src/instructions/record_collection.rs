use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Collection, Hub, PhotoSeal, Picker, Polymer},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecordCollectionArgs {
    pub picker_hash: [u8; 32],
    pub photo_hash: [u8; 32],
    pub weight_g: u64,
    pub polymer: Polymer,
    pub contamination_bps: u16,
    /// Payout in mint base units, priced off-chain from the AI grade and signed by the hub.
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: RecordCollectionArgs)]
pub struct RecordCollection<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [HUB_SEED, authority.key().as_ref()],
        bump = hub.bump,
        has_one = authority,
        has_one = mint,
        has_one = escrow,
    )]
    pub hub: Account<'info, Hub>,
    #[account(
        init,
        payer = authority,
        space = 8 + Collection::INIT_SPACE,
        seeds = [COLLECTION_SEED, hub.key().as_ref(), &hub.collection_count.to_le_bytes()],
        bump
    )]
    pub collection: Account<'info, Collection>,
    /// Fails with "already in use" if this exact photo was recorded before.
    #[account(
        init,
        payer = authority,
        space = 8 + PhotoSeal::INIT_SPACE,
        seeds = [PHOTO_SEED, args.photo_hash.as_ref()],
        bump
    )]
    pub photo_seal: Account<'info, PhotoSeal>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Picker::INIT_SPACE,
        seeds = [PICKER_SEED, hub.key().as_ref(), args.picker_hash.as_ref()],
        bump
    )]
    pub picker: Account<'info, Picker>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,
    /// The picker's wallet token account. Omit it to accrue the payout to the picker's claim balance.
    #[account(mut, token::mint = mint)]
    pub picker_token: Option<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_record_collection(ctx: Context<RecordCollection>, args: RecordCollectionArgs) -> Result<()> {
    require!(args.weight_g > 0, ErrorCode::ZeroWeight);
    require!(args.contamination_bps <= MAX_CONTAMINATION_BPS, ErrorCode::ContaminationOutOfRange);

    let hub_key = ctx.accounts.hub.key();
    let now = Clock::get()?.unix_timestamp;

    let paid_to = match &ctx.accounts.picker_token {
        Some(dest) => {
            let authority_key = ctx.accounts.hub.authority;
            let seeds: &[&[u8]] = &[HUB_SEED, authority_key.as_ref(), &[ctx.accounts.hub.bump]];
            token::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.escrow.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: dest.to_account_info(),
                        authority: ctx.accounts.hub.to_account_info(),
                    },
                    &[seeds],
                ),
                args.amount,
                ctx.accounts.mint.decimals,
            )?;
            dest.owner
        }
        None => Pubkey::default(),
    };

    let picker = &mut ctx.accounts.picker;
    if picker.collections == 0 {
        picker.picker_hash = args.picker_hash;
        picker.bump = ctx.bumps.picker;
    }
    picker.collections = picker.collections.checked_add(1).ok_or(ErrorCode::Overflow)?;
    picker.weight_g = picker.weight_g.checked_add(args.weight_g).ok_or(ErrorCode::Overflow)?;

    let hub = &mut ctx.accounts.hub;
    if paid_to == Pubkey::default() {
        picker.owed = picker.owed.checked_add(args.amount).ok_or(ErrorCode::Overflow)?;
        hub.owed_total = hub.owed_total.checked_add(args.amount).ok_or(ErrorCode::Overflow)?;
    } else {
        picker.paid = picker.paid.checked_add(args.amount).ok_or(ErrorCode::Overflow)?;
        hub.paid_total = hub.paid_total.checked_add(args.amount).ok_or(ErrorCode::Overflow)?;
    }

    let index = hub.collection_count;
    hub.collection_count = index.checked_add(1).ok_or(ErrorCode::Overflow)?;
    hub.collected_g = hub.collected_g.checked_add(args.weight_g).ok_or(ErrorCode::Overflow)?;

    ctx.accounts.photo_seal.collection = ctx.accounts.collection.key();
    ctx.accounts.collection.set_inner(Collection {
        hub: hub_key,
        index,
        picker_hash: args.picker_hash,
        paid_to,
        weight_g: args.weight_g,
        polymer: args.polymer,
        contamination_bps: args.contamination_bps,
        amount: args.amount,
        photo_hash: args.photo_hash,
        created_at: now,
    });
    Ok(())
}
