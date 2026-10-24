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

## Devnet

- Program: [`47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz`](https://explorer.solana.com/address/47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz?cluster=devnet)
- Demo hub: `Gm7y3vCkLiEHvxzPSxUfMLd8kcgTbJ7FcxktM6ERyU2i`, escrow `93MqjtctHhZTUt8EEZeMBQYAuFVHNorRBsNhYkBApbwg`
- tUSDC mint: `664ePnGgSywRELeAz2davzvyBAAyg1qewfFT7AfQxgeC`
- First paid bag: [`4N75Qo…Cku3`](https://explorer.solana.com/tx/4N75QorLLsxuvhXKLQAKyZCvSEYvLFTVSFpPuM84b58BebCpJ5SWQko3KQLdQg5GJHLNzfaRUjYP7NdDAnbyCku3?cluster=devnet)

## Run

```bash
anchor build --arch v1 && cargo test  # program + LiteSVM tests (always --arch v1)
pnpm install && pnpm setup:devnet   # devnet actors + tUSDC mint (idempotent; funds from your Solana CLI wallet)
pnpm generate:client                # IDL → app/src/generated/pickpay (after anchor build)
pnpm smoke:devnet                   # init hub, fund escrow, pay one bag on devnet
cd app && pnpm install && pnpm dev  # http://localhost:3000
```

## Plan

Deadline: **Sun 2026-10-25 15:00 WAT** (Devpost). Submit by 13:00 WAT.

### M1 · Day 1 (2026-10-23): Scaffold
- [x] Anchor workspace and Next.js app in `app/`, both build
- [x] Make the template LiteSVM test pass (Anchor 1.2 defaults to SBPF v3, which LiteSVM 0.10 can't load; build with `--arch v1` on Agave 3.1.14)
- [x] Devnet wallets (hub, recycler, brand A, brand B, picker) funded, plus a devnet test-USDC mint, saved by `scripts/setup-devnet.ts` (`pnpm setup:devnet`; addresses in `scripts/devnet.json`, keys in `.keys/`)

### M2 · Day 2 (2026-10-24): Program core
- [x] State accounts: Hub (collected/shipped g, escrow), Collection, Picker (phone-hash claim balance), PhotoSeal (one per photo hash), Bale, CreditBatch, Claim
- [x] `init_hub` and `record_collection` with an SPL transfer payout to the picker (or to a phone-hash claim account); 6 LiteSVM tests incl. duplicate photo and wrong mint
- [x] `ship_bale` (≤ unshipped collected kg), `confirm_intake` (recycler signer, ≤ bale kg, mints credits), `claim_credits` (single retirement)
- [x] LiteSVM tests: happy path, `ExceedsCollected`, `ExceedsIntake`, `AlreadyClaimed` (plus wrong recycler and double intake; 11 tests total)
- [x] Deploy to devnet and generate the TS client into `app/` (`pnpm generate:client` → `app/src/generated/pickpay`; `pnpm smoke:devnet` pays a picker on devnet)

### M3 · Day 2 (2026-10-24): Wow moment
- [ ] `/api/grade`: Claude vision → polymer and contamination → ₦/kg and USDC amount (built and returns a signed quote; live grade on a real photo still to run once `app/.env.local` has the key)
- [x] Hub screen: phone, weight, photo → grade → "Pay" sends `record_collection` and shows the confirmed transaction (`/hub` + `/api/collect`; Pay verified on devnet in 0.8 s)
- [x] Brand screen: claim credits; a second brand claiming the same credits shows the live `AlreadyClaimed` rejection (`/brand`; the rejected claim lands on devnet as a failed tx, error 6004)

### M4 · Day 2 (2026-10-24): Ledger and fraud (scope freeze 22:00 WAT)
- [x] Perceptual-hash duplicate-photo check that blocks a reused photo (64-bit dHash via sharp, ≤10 bits = same photo; checked in `/api/grade` before the AI call and again in `/api/collect`; index in `app/.data/`, exact SHA-256 still sealed on-chain)
- [x] Public ledger page `/ledger/[claim]` tracing claim → credits → intake → bales → bags (all from devnet accounts; `/ledger` lists claims; hub photos shown only when their SHA-256 matches the chain)
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
