#![allow(dead_code)]
use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, system_program,
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    litesvm_token::{get_spl_account, spl_token, CreateMint, MintTo},
    pickpay::{
        accounts, instruction, state::{Hub, Polymer}, RecordCollectionArgs, COLLECTION_SEED,
        ESCROW_SEED, HUB_SEED, PHOTO_SEED, PICKER_SEED, BALE_SEED, CREDITS_SEED, CLAIM_SEED,
        state::CreditBatch,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

pub const FLOAT: u64 = 10_000_000_000; // 10,000 tUSDC at 6 decimals

pub struct Ctx {
    pub svm: LiteSVM,
    pub hub_authority: Keypair,
    pub mint: Pubkey,
    pub hub: Pubkey,
    pub escrow: Pubkey,
}

pub fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &pickpay::id()).0
}

pub fn send(svm: &mut LiteSVM, ix: Instruction, signer: &Keypair) -> Result<(), String> {
    let msg = Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).unwrap();
    let res = svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?} {:?}", e.err, e.meta.logs));
    svm.expire_blockhash();
    res
}

pub fn account<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    T::try_deserialize(&mut svm.get_account(key).unwrap().data.as_slice()).unwrap()
}

pub fn token_balance(svm: &LiteSVM, key: &Pubkey) -> u64 {
    get_spl_account::<spl_token::state::Account>(svm, key).unwrap().amount
}

/// A hub with an initialised escrow holding FLOAT tUSDC.
pub fn setup() -> Ctx {
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

pub fn args(picker: u8, photo: u8, weight_g: u64, amount: u64) -> RecordCollectionArgs {
    RecordCollectionArgs {
        picker_hash: [picker; 32],
        photo_hash: [photo; 32],
        weight_g,
        polymer: Polymer::Pet,
        contamination_bps: 600,
        amount,
    }
}

pub fn record_ix(c: &Ctx, a: RecordCollectionArgs, picker_token: Option<Pubkey>) -> Instruction {
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
    pub fn record(&mut self, a: RecordCollectionArgs, picker_token: Option<Pubkey>) -> Result<(), String> {
        let ix = record_ix(self, a, picker_token);
        send(&mut self.svm, ix, &self.hub_authority)
    }
}

impl Ctx {
    pub fn bale_pda(&self, index: u64) -> Pubkey {
        pda(&[BALE_SEED, self.hub.as_ref(), &index.to_le_bytes()])
    }

    /// Ships the next bale; returns its address.
    pub fn ship(&mut self, weight_g: u64, recycler: &Pubkey) -> Result<Pubkey, String> {
        let hub: Hub = account(&self.svm, &self.hub);
        let bale = self.bale_pda(hub.bale_count);
        let ix = Instruction::new_with_bytes(
            pickpay::id(),
            &instruction::ShipBale { weight_g, recycler: *recycler }.data(),
            accounts::ShipBale { authority: self.hub_authority.pubkey(), hub: self.hub, bale, system_program: system_program::ID }
                .to_account_metas(None),
        );
        send(&mut self.svm, ix, &self.hub_authority).map(|_| bale)
    }

    /// Confirms intake as `recycler`; returns the credit batch address.
    pub fn intake(&mut self, recycler: &Keypair, bale: &Pubkey, accepted_g: u64) -> Result<Pubkey, String> {
        let credit_batch = pda(&[CREDITS_SEED, bale.as_ref()]);
        let ix = Instruction::new_with_bytes(
            pickpay::id(),
            &instruction::ConfirmIntake { accepted_g }.data(),
            accounts::ConfirmIntake { recycler: recycler.pubkey(), bale: *bale, credit_batch, system_program: system_program::ID }
                .to_account_metas(None),
        );
        send(&mut self.svm, ix, recycler).map(|_| credit_batch)
    }

    /// Retires credits from `batch` for `brand`; returns the claim address.
    pub fn claim(&mut self, brand: &Keypair, batch: &Pubkey, weight_g: u64) -> Result<Pubkey, String> {
        let b: CreditBatch = account(&self.svm, batch);
        let claim = pda(&[CLAIM_SEED, batch.as_ref(), &b.claim_count.to_le_bytes()]);
        let ix = Instruction::new_with_bytes(
            pickpay::id(),
            &instruction::ClaimCredits { weight_g }.data(),
            accounts::ClaimCredits { brand: brand.pubkey(), credit_batch: *batch, claim, system_program: system_program::ID }
                .to_account_metas(None),
        );
        send(&mut self.svm, ix, brand).map(|_| claim)
    }

    pub fn funded(&mut self) -> Keypair {
        let k = Keypair::new();
        self.svm.airdrop(&k.pubkey(), 1_000_000_000).unwrap();
        k
    }
}

pub fn assert_custom<T: std::fmt::Debug>(res: Result<T, String>, code: u32) {
    let err = res.expect_err("transaction should fail");
    assert!(err.contains(&format!("Custom({code})")), "expected Custom({code}), got {err}");
}

