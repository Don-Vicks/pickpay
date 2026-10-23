mod common;

use {
    common::*,
    pickpay::state::{Bale, Claim, CreditBatch, Hub},
    solana_signer::Signer,
};

const EXCEEDS_COLLECTED: u32 = 6002;
const EXCEEDS_INTAKE: u32 = 6003;
const ALREADY_CLAIMED: u32 = 6004;
const WRONG_RECYCLER: u32 = 6006;

/// A hub that has recorded two bags: 4 kg + 6 kg.
fn hub_with_bags() -> Ctx {
    let mut c = setup();
    c.record(args(1, 1, 4_000, 1_000_000), None).unwrap();
    c.record(args(2, 2, 6_000, 1_500_000), None).unwrap();
    c
}

#[test]
fn full_chain_bag_to_bale_to_credit_to_claim() {
    let mut c = hub_with_bags();
    let recycler = c.funded();
    let brand = c.funded();

    let bale = c.ship(10_000, &recycler.pubkey()).unwrap();
    let b: Bale = account(&c.svm, &bale);
    assert_eq!((b.weight_g, b.first_collection, b.end_collection, b.intake_confirmed), (10_000, 0, 2, false));

    let batch = c.intake(&recycler, &bale, 9_500).unwrap();
    let cb: CreditBatch = account(&c.svm, &batch);
    assert_eq!((cb.accepted_g, cb.claimed_g, cb.recycler), (9_500, 0, recycler.pubkey()));
    assert!(account::<Bale>(&c.svm, &bale).intake_confirmed);

    let claim = c.claim(&brand, &batch, 9_500).unwrap();
    let cl: Claim = account(&c.svm, &claim);
    assert_eq!((cl.brand, cl.weight_g, cl.batch), (brand.pubkey(), 9_500, batch));
    assert_eq!(account::<CreditBatch>(&c.svm, &batch).claimed_g, 9_500);

    let hub: Hub = account(&c.svm, &c.hub);
    assert_eq!((hub.collected_g, hub.shipped_g, hub.bale_count, hub.next_unbaled), (10_000, 10_000, 1, 2));
}

#[test]
fn ship_bale_cannot_exceed_collected() {
    let mut c = hub_with_bags();
    let recycler = c.funded();
    assert_custom(c.ship(10_001, &recycler.pubkey()), EXCEEDS_COLLECTED);
    // Two bales together can't exceed it either.
    c.ship(7_000, &recycler.pubkey()).unwrap();
    assert_custom(c.ship(3_001, &recycler.pubkey()), EXCEEDS_COLLECTED);
    let leftover = c.ship(3_000, &recycler.pubkey()).unwrap();
    let b: Bale = account(&c.svm, &leftover);
    assert_eq!(b.first_collection, b.end_collection, "leftover bale carries no new bags");
}

#[test]
fn confirm_intake_cannot_exceed_bale_or_repeat() {
    let mut c = hub_with_bags();
    let recycler = c.funded();
    let bale = c.ship(10_000, &recycler.pubkey()).unwrap();
    assert_custom(c.intake(&recycler, &bale, 10_001), EXCEEDS_INTAKE);
    c.intake(&recycler, &bale, 10_000).unwrap();
    let again = c.intake(&recycler, &bale, 1);
    assert!(again.unwrap_err().contains("already in use"), "intake confirms once per bale");
}

#[test]
fn only_named_recycler_confirms_intake() {
    let mut c = hub_with_bags();
    let recycler = c.funded();
    let impostor = c.funded();
    let bale = c.ship(10_000, &recycler.pubkey()).unwrap();
    assert_custom(c.intake(&impostor, &bale, 10_000), WRONG_RECYCLER);
}

#[test]
fn second_brand_cannot_claim_retired_credits() {
    let mut c = hub_with_bags();
    let recycler = c.funded();
    let brand_a = c.funded();
    let brand_b = c.funded();
    let bale = c.ship(10_000, &recycler.pubkey()).unwrap();
    let batch = c.intake(&recycler, &bale, 8_000).unwrap();

    c.claim(&brand_a, &batch, 5_000).unwrap();
    // Brand B may take what's left, but not the kilos brand A already retired.
    assert_custom(c.claim(&brand_b, &batch, 5_000), ALREADY_CLAIMED);
    c.claim(&brand_b, &batch, 3_000).unwrap();
    assert_custom(c.claim(&brand_a, &batch, 1), ALREADY_CLAIMED);
    let cb: CreditBatch = account(&c.svm, &batch);
    assert_eq!((cb.claimed_g, cb.claim_count), (8_000, 2));
}
