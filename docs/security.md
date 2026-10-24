# Security and data-integrity assessment

PickPay's claim is narrow and checkable: **a recovery credit can't exist without a recycler's signature, and a credited kilo can't be claimed twice.** This document sets out what the system guarantees, what it doesn't, and how each weakness is handled now or planned. The program has not been audited; it runs on devnet only.

## What is guaranteed by the program

These hold whatever the app server, the hub or the AI does, because the program checks them on every transaction:

1. **No credit without intake.** Credits are created only by `confirm_intake`, which must be signed by the recycler named on the bale when it shipped (`WrongRecycler` otherwise), and only once per bale (the credit batch PDA is derived from the bale).
2. **No credit beyond what was shipped.** `accepted_g ≤ bale.weight_g` (`ExceedsIntake`), and a hub's total shipped weight can't exceed its recorded collections (`ExceedsCollected`).
3. **No double claim.** `claimed_g + weight_g ≤ accepted_g` for every claim (`AlreadyClaimed`). All brands draw from the same account, so two brands, or one brand twice, can't count the same kilos.
4. **One photo, one paid bag.** `PhotoSeal` is a PDA seeded by the photo's SHA-256; a second bag with the same bytes fails to create it.
5. **Payment and record can't drift apart.** The picker's payout is a `transfer_checked` CPI inside `record_collection`; the bag record and the payment succeed or fail together. The escrow is owned by the hub PDA, so only the program can move it.
6. **Arithmetic and accounts.** Every counter uses checked arithmetic (`Overflow`). Accounts are bound by seeds and `has_one` constraints (hub authority, mint, escrow); the payout account must use the hub's mint; every state change requires the right signer.

These are covered by 11 LiteSVM tests against the compiled program, and the double-claim rejection has been reproduced on devnet ([failed transaction](https://explorer.solana.com/tx/51yiePXZJKvFXvQvSdzht5JxMfP4JjE84U1PNfatRq7uac5GX4XtsvN1vrcnfJ5DoWuyzrDBGqrzBLmX2aYQf7pJ?cluster=devnet), error 6004).

## Threat model

| # | Threat | Who | Mitigation now | What remains |
|---|---|---|---|---|
| 1 | **Hub inflates weights** to pay friends or pad its numbers | hub | The hub pays inflated bags from its own escrow, so it funds its own fraud. Inflated weight never becomes credit: the recycler weighs the bale independently and can accept less than shipped. The gap between collected and accepted is public per hub. | A hub and recycler who collude can still invent kilos. Planned: hubs post a stake that a recycler or auditor can slash on a disputed bale, connected scales that sign weights, and random audits of high-gap hubs. |
| 2 | **Same photo paid twice** | hub or picker | Exact copy: rejected on-chain by `PhotoSeal`. Resized, recompressed or brightened copy: rejected by a 64-bit perceptual hash (≤10 differing bits) before grading and again before payment. | A cropped or rotated copy, or a fresh photo of the same bag, can pass. The recycler's intake cap (threat 1) bounds the damage; the index lives on the hub, not on-chain. |
| 3 | **Tampered payout** from the browser | anyone with the hub screen | The price is computed on the server. `/api/grade` signs the quote (photo hash, perceptual hash, weight, polymer, contamination, amount, 10-minute expiry) with an HMAC key derived from the hub's secret; `/api/collect` pays only a valid, unexpired quote. Tested: an edited amount is rejected. | Whoever holds the hub key can still sign anything (threat 7). |
| 4 | **Quote replay** | anyone | A quote is bound to one photo hash; after it's paid, `PhotoSeal` and the duplicate index reject a second payment. | None known. |
| 5 | **Misleading the AI grade** (e.g. text in the photo saying "clean PET") | picker | The model returns a strict JSON schema against a fixed rubric; the price is bounded by the clean rate for the polymer × weight, so a wrong grade can at most move a bag to the best clean rate. The hub agent sees the grade, confidence and note before paying. | Systematic over-grading. Planned: log grades against recycler intake to measure per-hub and per-model accuracy; a second-opinion grade above a value threshold. |
| 6 | **Recycler over-accepts** to create credits | recycler | Capped at the bale weight; only the named recycler can sign; one intake per bale. | A recycler accepting a bale it never received, in collusion with a hub (threat 1). |
| 7 | **Key theft or abuse** | attacker, insider | Demo only: the server holds the hub, recycler and brand keys in `.keys/` (gitignored) so one machine can run the demo. | A stolen hub key can pay out the escrow through `record_collection`. Production plan: each party signs on its own device or wallet; hub keys on a managed device with a low escrow float topped up daily; a per-bag payout cap and daily limit in the program. |
| 8 | **Program upgrade** | deployer | Devnet only; the upgrade authority is the developer's key. | Production: upgrade authority held by a multisig, then frozen once stable; verifiable builds. |
| 9 | **Server-side shortcuts** | app operator | Nothing that matters is enforced only by the server: claims are sent without preflight so the program, not the server, decides; every ledger figure is read from chain state. | The duplicate-photo index and quote signing are server-side by design (threats 2, 3). |
| 10 | **Fake ledger page** | anyone | Each figure links to the account on a public explorer; a bag photo is marked verified only if its SHA-256 matches the hash stored on-chain. The trace page accepts only accounts owned by the program with the `Claim` discriminator. | Readers must use the explorer links to trust a copy hosted elsewhere. |

## Privacy

- **Pickers:** only `SHA-256(salt : E.164 phone)` goes on-chain. With the salt, phone numbers are easy to brute-force (the number space is small), so the salt is a server secret (`PICKER_SALT`) per deployment and must not be published. Bags by the same picker are linkable to each other on-chain under that pseudonym.
- **Photos:** stored on the hub, not on-chain; only their hashes are public. Bag photos should not show people; the hub screen asks for a photo of the bag.
- **Brands and recyclers:** identified by their public keys, which is the point: claims are meant to be public.

## Data integrity, end to end

| Fact | Source of truth | How a reader checks it |
|---|---|---|
| A bag was weighed, graded and paid | `Collection` account + the payout transaction | Explorer link on the ledger page |
| The photo is the one graded | SHA-256 in `Collection.photo_hash` | Ledger shows "photo matches the blockchain record ✓" after hashing the stored file |
| A recycler received the plastic | `CreditBatch` created by the recycler's signature | The intake transaction's signer |
| A brand's claim is unique | `CreditBatch.claimed_g ≤ accepted_g` | Batch account; the failed transaction for any over-claim |

## Known gaps, in order of priority

1. Hub–recycler collusion (threats 1 and 6): staking and slashing, signed scales, audits.
2. Key custody (threat 7): per-party signing, payout caps, small floats.
3. Pickers' accrued balances have no withdrawal instruction yet; funds stay in the hub's escrow until one is added.
4. No independent audit of the program.
