mod common;

use {
    common::*,
    litesvm_token::{get_spl_account, spl_token, CreateAssociatedTokenAccount, CreateMint},
    pickpay::{
        state::{Collection, Hub, Picker, Polymer},
        COLLECTION_SEED, PICKER_SEED,
    },
    solana_keypair::Keypair,
    solana_signer::Signer,
};

#[test]
fn init_hub_sets_up_escrow() {
    let c = setup();
    let hub: Hub = account(&c.svm, &c.hub);
    assert_eq!(hub.authority, c.hub_authority.pubkey());
    assert_eq!(hub.mint, c.mint);
    assert_eq!(hub.escrow, c.escrow);
    assert_eq!(hub.collection_count, 0);
    let escrow = get_spl_account::<spl_token::state::Account>(&c.svm, &c.escrow).unwrap();
    assert_eq!(escrow.owner, c.hub);
    assert_eq!(escrow.amount, FLOAT);
}

#[test]
fn record_collection_pays_picker_wallet_in_same_tx() {
    let mut c = setup();
    let picker_wallet = Keypair::new();
    let picker_ata = CreateAssociatedTokenAccount::new(&mut c.svm, &c.hub_authority, &c.mint)
        .owner(&picker_wallet.pubkey())
        .send()
        .unwrap();

    let ix = record_ix(&c, args(1, 1, 6_200, 1_550_000), Some(picker_ata));
    send(&mut c.svm, ix, &c.hub_authority).unwrap();

    assert_eq!(token_balance(&c.svm, &picker_ata), 1_550_000);
    assert_eq!(token_balance(&c.svm, &c.escrow), FLOAT - 1_550_000);
    let hub: Hub = account(&c.svm, &c.hub);
    assert_eq!((hub.collection_count, hub.collected_g, hub.paid_total, hub.owed_total), (1, 6_200, 1_550_000, 0));
    let col: Collection = account(&c.svm, &pda(&[COLLECTION_SEED, c.hub.as_ref(), &0u64.to_le_bytes()]));
    assert_eq!(col.paid_to, picker_wallet.pubkey());
    assert_eq!((col.weight_g, col.polymer, col.contamination_bps), (6_200, Polymer::Pet, 600));
}

#[test]
fn record_collection_without_wallet_accrues_to_picker_claim() {
    let mut c = setup();
    c.record(args(2, 1, 4_000, 1_000_000), None).unwrap();
    c.record(args(2, 2, 3_000, 750_000), None).unwrap();

    assert_eq!(token_balance(&c.svm, &c.escrow), FLOAT, "funds stay in escrow until claimed");
    let picker: Picker = account(&c.svm, &pda(&[PICKER_SEED, c.hub.as_ref(), &[2; 32]]));
    assert_eq!((picker.collections, picker.weight_g, picker.owed, picker.paid), (2, 7_000, 1_750_000, 0));
    let hub: Hub = account(&c.svm, &c.hub);
    assert_eq!((hub.collected_g, hub.owed_total, hub.paid_total), (7_000, 1_750_000, 0));
}

#[test]
fn same_photo_cannot_back_two_collections() {
    let mut c = setup();
    c.record(args(3, 9, 5_000, 1_000_000), None).unwrap();
    let res = c.record(args(4, 9, 5_000, 1_000_000), None);
    assert!(res.unwrap_err().contains("already in use"));
    let hub: Hub = account(&c.svm, &c.hub);
    assert_eq!(hub.collected_g, 5_000);
}

#[test]
fn rejects_zero_weight_and_bad_contamination() {
    let mut c = setup();
    assert_custom(c.record(args(5, 5, 0, 1), None), 6000);
    let mut bad = args(5, 6, 1_000, 1);
    bad.contamination_bps = 10_001;
    assert_custom(c.record(bad, None), 6001);
}

#[test]
fn rejects_payout_account_with_wrong_mint() {
    let mut c = setup();
    let other_mint = CreateMint::new(&mut c.svm, &c.hub_authority).decimals(6).send().unwrap();
    let wrong_ata = CreateAssociatedTokenAccount::new(&mut c.svm, &c.hub_authority, &other_mint)
        .owner(&Keypair::new().pubkey())
        .send()
        .unwrap();
    let res = c.record(args(6, 7, 1_000, 1), Some(wrong_ata));
    // Anchor's ConstraintTokenMint
    assert_custom(res, 2014);
}
