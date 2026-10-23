use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, system_program,
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    litesvm_token::{get_spl_account, spl_token, CreateAssociatedTokenAccount, CreateMint, MintTo},
    pickpay::{
        accounts, instruction, state::{Collection, Hub, Picker, Polymer}, RecordCollectionArgs,
        COLLECTION_SEED, ESCROW_SEED, HUB_SEED, PHOTO_SEED, PICKER_SEED,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const FLOAT: u64 = 10_000_000_000; // 10,000 tUSDC at 6 decimals

struct Ctx {
    svm: LiteSVM,
    hub_authority: Keypair,
    mint: Pubkey,
    hub: Pubkey,
    escrow: Pubkey,
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &pickpay::id()).0
}

fn send(svm: &mut LiteSVM, ix: Instruction, signer: &Keypair) -> Result<(), String> {
    let msg = Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).unwrap();
    let res = svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?} {:?}", e.err, e.meta.logs));
    svm.expire_blockhash();
    res
}

fn account<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    T::try_deserialize(&mut svm.get_account(key).unwrap().data.as_slice()).unwrap()
}

fn token_balance(svm: &LiteSVM, key: &Pubkey) -> u64 {
    get_spl_account::<spl_token::state::Account>(svm, key).unwrap().amount
}

/// A hub with an initialised escrow holding FLOAT tUSDC.
fn setup() -> Ctx {
    let mut svm = LiteSVM::new();
    svm.add_program(pickpay::id(), include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/pickpay.so")))
        .unwrap();
    let hub_authority = Keypair::new();
    svm.airdrop(&hub_authority.pubkey(), 10_000_000_000).unwrap();
    let mint = CreateMint::new(&mut svm, &hub_authority).decimals(6).send().unwrap();

    let hub = pda(&[HUB_SEED, hub_authority.pubkey().as_ref()]);
    let escrow = pda(&[ESCROW_SEED, hub.as_ref()]);
    let ix = Instruction::new_with_bytes(
        pickpay::id(),
        &instruction::InitHub {}.data(),
        accounts::InitHub {
            authority: hub_authority.pubkey(),
            hub,
            mint,
            escrow,
            token_program: spl_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut svm, ix, &hub_authority).unwrap();
    MintTo::new(&mut svm, &hub_authority, &mint, &escrow, FLOAT).send().unwrap();
    Ctx { svm, hub_authority, mint, hub, escrow }
}

fn args(picker: u8, photo: u8, weight_g: u64, amount: u64) -> RecordCollectionArgs {
    RecordCollectionArgs {
        picker_hash: [picker; 32],
        photo_hash: [photo; 32],
        weight_g,
        polymer: Polymer::Pet,
        contamination_bps: 600,
        amount,
    }
}

fn record_ix(c: &Ctx, a: RecordCollectionArgs, picker_token: Option<Pubkey>) -> Instruction {
    let hub: Hub = account(&c.svm, &c.hub);
    Instruction::new_with_bytes(
        pickpay::id(),
        &instruction::RecordCollection { args: a.clone() }.data(),
        accounts::RecordCollection {
            authority: c.hub_authority.pubkey(),
            hub: c.hub,
            collection: pda(&[COLLECTION_SEED, c.hub.as_ref(), &hub.collection_count.to_le_bytes()]),
            photo_seal: pda(&[PHOTO_SEED, a.photo_hash.as_ref()]),
            picker: pda(&[PICKER_SEED, c.hub.as_ref(), a.picker_hash.as_ref()]),
            mint: c.mint,
            escrow: c.escrow,
            picker_token,
            token_program: spl_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

impl Ctx {
    fn record(&mut self, a: RecordCollectionArgs, picker_token: Option<Pubkey>) -> Result<(), String> {
        let ix = record_ix(self, a, picker_token);
        send(&mut self.svm, ix, &self.hub_authority)
    }
}

fn assert_custom(res: Result<(), String>, code: u32) {
    let err = res.expect_err("transaction should fail");
    assert!(err.contains(&format!("Custom({code})")), "expected Custom({code}), got {err}");
}

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
