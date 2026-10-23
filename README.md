# PickPay

**Every kilo paid once, claimed once.** Waste pickers are paid in seconds for AI-graded plastic, and every kilo becomes an EPR recovery credit. A credit exists only after a recycler confirms intake, and it can be claimed by exactly one brand.

Built for the [IEEE ClimateChain Global Hackathon](https://ieee-climatechain-hack.devpost.com/), Track 3: Sustainable Supply Chains (recycling traceability, circular economy incentives).

## Idea

Brands with Extended Producer Responsibility (EPR) targets must prove they recovered the packaging they sold. Today that proof is an aggregator's spreadsheet, and pickers wait days or weeks to be paid. PickPay puts the whole chain (bag → bale → recycler intake → credit → brand claim) on one public Solana ledger. The program enforces **collected ≥ shipped ≥ credited ≥ claimed**, and pays the picker in the same transaction that records the bag.

- **Hub agent:** weighs a bag and photographs it. AI grades the polymer and contamination, which sets ₦/kg, and the picker is paid at once.
- **Recycler:** signs intake for a bale, which mints recovery credits equal to the accepted kg.
- **Brand:** retires credits against its EPR target. A second claim on the same credits fails on-chain.
- **Anyone:** traces a brand claim down to the individual bags. Picker IDs are hashed.

## MVP

- [ ] Anchor program on devnet with `init_hub`, `record_collection` (pays the picker in the same transaction), `ship_bale`, `confirm_intake` (recycler-signed, mints credits) and `claim_credits`; errors `ExceedsCollected`, `ExceedsIntake`, `AlreadyClaimed`; LiteSVM tests for each
- [ ] Devnet USDC-style SPL payout from hub escrow, with a claimable account keyed by a phone hash for pickers without wallets
- [ ] AI grading: Claude vision returns polymer (PET/HDPE/mixed) and contamination %, which set ₦/kg; a perceptual-hash check rejects reused photos
- [ ] Hub screen (mobile web): phone, weight, photo → grade → pay
- [ ] Public ledger page: brand claim → credits → intake → bales → bags (photo hash, grade)
- [ ] Seed script: hub, recycler, two brands and about 15 real bag photos, so the demo replays the same way every time

## Stack

- **Program:** Anchor 1.2 (Rust), LiteSVM tests, Solana devnet, SPL Token
- **App:** Next.js 15 (App Router), React 19, TypeScript, Tailwind, pnpm (`app/`)
- **Client:** `@solana/kit` with an IDL-generated client (fallback: `@coral-xyz/anchor` in scripts)
- **AI:** Claude vision via `@anthropic-ai/sdk` (key in `app/.env.local`, never committed)
- **Photos:** `sharp` for perceptual hashes; photos in `app/public/bags/`; no database, the chain is the store

## Run

```bash
anchor build && cargo test          # program + LiteSVM tests
cd app && pnpm install && pnpm dev  # http://localhost:3000
```

## Plan

Deadline: **Sun 2026-10-25 15:00 WAT** (Devpost). Submit by 13:00 WAT.

### M1 · Day 1 (2026-10-23): Scaffold
- [x] Anchor workspace and Next.js app in `app/`, both build
- [ ] Make the template LiteSVM test pass: `add_program` fails with `InvalidAccountData` loading `pickpay.so` (likely Anchor 1.2 vs Solana CLI 2.3.13 toolchain mismatch)
- [ ] Devnet wallets (hub, recycler, brand A, brand B) funded, plus a devnet test-USDC mint, saved by a `scripts/setup-devnet.ts`

### M2 · Day 2 (2026-10-24): Program core
- [ ] State accounts: Hub (collected/shipped kg, escrow), Collection, Bale, Intake/CreditBatch, Claim
- [ ] `init_hub` and `record_collection` with an SPL transfer payout to the picker (or to a phone-hash claim account)
- [ ] `ship_bale` (≤ unshipped collected kg), `confirm_intake` (recycler signer, ≤ bale kg, mints credits), `claim_credits` (single retirement)
- [ ] LiteSVM tests: happy path, `ExceedsCollected`, `ExceedsIntake`, `AlreadyClaimed`
- [ ] Deploy to devnet and generate the TS client into `app/`

### M3 · Day 2 (2026-10-24): Wow moment
- [ ] `/api/grade`: Claude vision → polymer and contamination → ₦/kg and USDC amount
- [ ] Hub screen: phone, weight, photo → grade → "Pay" sends `record_collection` and shows the confirmed transaction
- [ ] Brand screen: claim credits; a second brand claiming the same credits shows the live `AlreadyClaimed` rejection

### M4 · Day 2 (2026-10-24): Ledger and fraud (scope freeze 22:00 WAT)
- [ ] Perceptual-hash duplicate-photo check that blocks a reused photo
- [ ] Public ledger page `/ledger/[claim]` tracing claim → credits → intake → bales → bags
- [ ] Take about 15 real bag photos; seed script replays the full demo on devnet

### M5 · Day 3 (2026-10-25): Judge docs (by 11:00 WAT)
- [ ] Judge-facing README: problem, how it works, "how this differs" table (Plastic Bank, Wecyclers, RecyclePoints), how to run
- [ ] Architecture diagram and technical spec (`docs/architecture.md`)
- [ ] Security and data-integrity assessment (`docs/security.md`): threat model, including the limit that a hub can lie about weight and how intake caps it
- [ ] 2-page problem and impact statement with cited CO2e figures, plus adoption and scalability roadmap (`docs/impact.md`)

### M6 · Day 3 (2026-10-25): Submit (by 13:00 WAT)
- [ ] 3-minute video script and recording: AI grade and payout at about 1:45, then the rejected double claim
- [ ] Devpost text: track alignment, problem, solution, users, scale, adoption
- [ ] Make the repo public, then submit on Devpost

## Submission checklist

- [ ] Track stated (Track 3) and how the project addresses it
- [ ] Project description: problem, solution, target users, how it scales, how easily it can be adopted
- [ ] Demo video, 3–5 min (aim for 3:00–3:30)
- [ ] Public GitHub repo with source and docs
- [ ] Working prototype (devnet program ID and app link or run steps)
- [ ] Architecture diagram and technical spec
- [ ] Security and data-integrity assessment
- [ ] Problem statement (≤2 pages), climate impact assessment, adoption and scalability roadmap
- [ ] Submitted before 2026-10-25 15:00 WAT
