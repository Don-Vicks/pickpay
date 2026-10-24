# PickPay

**Every kilo paid once, claimed once.**

PickPay pays Lagos waste pickers within seconds for plastic that AI grades from a photo. Every kilo they bring in becomes a recycling credit that exists only after a recycler confirms it received the plastic, and that exactly one brand can claim against its producer-responsibility target. The whole chain, from a picker's bag to a brand's claim, is one public Solana ledger that anyone can check.

Built for the [IEEE ClimateChain Global Hackathon](https://ieee-climatechain-hack.devpost.com/) · **Track 3: Sustainable Supply Chains** (recycling traceability, circular economy incentives).

- **Live program (Solana devnet):** [`47EHi4…gLTz`](https://explorer.solana.com/address/47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz?cluster=devnet)
- **Demo video:** _link added at submission_
- **Docs:** [architecture](docs/architecture.md) · [security and data integrity](docs/security.md) · [problem and climate impact](docs/impact.md) · [demo script](docs/video-script.md)

## The problem

- **Plastic leaks because collecting it doesn't pay fast enough.** Nigeria generates about 2.5 million tonnes of plastic waste a year, Lagos about 870,000 tonnes ([NESG policy brief, 2023](https://nesgroup.org/download_resource_documents/NRFP%20Policy%20Brief-%20Dr%20Theresa%20&%20Peter%20Agada%20Ali_1701187431.pdf)). Lagos collects an estimated 20–30% and recycles about 13% ([WACA/ENB, 2022](https://www.wacaprogram.org/sites/waca/files/knowdoc/Wednesday%20Webinar_Healthcare%20plastic%20waste%20management%20in%20Nigeria_%2020220209.pdf)). Informal pickers do much of that collecting and are paid in cash, late, by weight that nobody records.
- **Producers now have to prove recovery.** Nigeria's National Environmental (Plastic Waste Control) Regulations 2026 put extended producer responsibility (EPR) at the centre: producers and importers are answerable for recovering what they put on the market, and PET packaging must reach 25% recycled content by January 2028 ([ThisDay, Sept 2026](https://www.thisdaylive.com/2026/09/04/nigeria-tightens-war-on-plastic-waste-makes-producers-responsible-for-end-of-life-products/)).
- **Today's proof is a spreadsheet.** A brand's evidence that it recovered a tonne is a report from whoever it paid. Nothing stops the same tonne being reported twice, or reported without ever reaching a recycler.

## What PickPay does

```
 picker ──bag──▶ HUB ──bale──▶ RECYCLER ──credits──▶ BRAND
          │              │                │                 │
   AI grade + pay    ship ≤ collected   accept ≤ shipped   claim ≤ accepted, once
   in one tx         (ship_bale)        (confirm_intake)   (claim_credits)
 (record_collection)
```

1. **Hub agent** (`/hub`, on a phone): enters the picker's phone number and the scale weight, and photographs the bag. Claude vision grades the polymer (PET, HDPE, mixed) and contamination, which sets the price in ₦/kg. **Pay** records the bag on-chain and pays the picker from the hub's escrow in the same transaction. A picker with no wallet accrues a balance under a salted hash of their phone number.
2. **Recycler** signs intake for a bale. That signature, and only that signature, creates recovery credits, never more than the bale weighed.
3. **Brand** (`/brand`) retires credits against its EPR target. Once retired, they're gone: a second claim on the same kilos fails inside the program.
4. **Anyone** (`/ledger`) can trace a brand's claim through the recycler's intake and the bale down to each paid bag, with its grade, payout and photo hash.

### The rule the chain enforces

**collected ≥ shipped ≥ credited ≥ claimed**, checked by the program on every instruction:

| Instruction | Signed by | Fails with |
|---|---|---|
| `record_collection` | hub | `ZeroWeight`, `ContaminationOutOfRange`, account-in-use for a reused photo |
| `ship_bale` | hub | `ExceedsCollected` |
| `confirm_intake` | the bale's named recycler | `ExceedsIntake`, `WrongRecycler`, account-in-use for a second intake |
| `claim_credits` | brand | `AlreadyClaimed` |

## What's new here

- **Credits are created by the recycler, not the collector.** Collection data alone never mints anything; a credit needs a recycler's signature on the bale it came from.
- **One claim per kilo, enforced by the program.** Brands, aggregators and regulators read the same accounts, so a tonne can't count toward two targets.
- **The picker is paid in the same transaction that records the bag.** Payment and evidence can't drift apart.
- **AI sets the price, and is checked.** The grade decides ₦/kg; the server signs the quote it computed, so a tampered request can't change the amount; reused photos are blocked before grading.
- **No database.** Every screen reads Solana accounts. The hub keeps only the photos, and the ledger shows a photo as verified only when its SHA-256 matches the hash on-chain.

## Try it

| Screen | What to do |
|---|---|
| `/hub` | Grade a bag photo and pay the picker; the confirmed transaction links to the explorer |
| `/brand` | Ship and confirm a bale, claim as Brand A, then claim the same kilos as Brand B and watch the program reject it |
| `/ledger` | Open any claim and follow it to the bags |

Run locally (macOS or Linux, Node 24, pnpm, Anchor 1.2, Agave 3.1):

```bash
pnpm install && pnpm setup:devnet        # devnet actors + test-USDC mint (funds from your Solana CLI wallet)
pnpm smoke:devnet                        # creates the demo hub and funds its escrow
cd app && cp .env.example .env.local     # add ANTHROPIC_API_KEY
pnpm install && pnpm dev                 # http://localhost:3000/hub
```

### Real vs mocked

- **Real:** the Anchor program and its 11 LiteSVM tests; every payout, bale, intake and claim on devnet; Claude vision grading; the perceptual-hash duplicate check; the public ledger.
- **Demo stand-ins:** test USDC instead of USDC or naira; one hub, one recycler and two brands whose keys the demo server holds; scale weight typed in rather than read from a scale; no withdrawal flow yet for pickers' phone-hash balances; no naira off-ramp or USSD.

## Roadmap

1. **Pilot (months 1–3):** one Lagos collection hub and one PET recycler, real USDC payouts with a naira off-ramp, a picker withdrawal flow and USSD for feature phones.
2. **Brands (months 3–6):** producer-responsibility organisations and brands claim credits for EPR reporting; monthly public reports generated from the ledger.
3. **Network (months 6–12):** more hubs and recyclers, staked hubs whose bags a recycler can dispute, connected scales that sign weights, and the same attestation pattern for other waste streams.

Details in [docs/impact.md](docs/impact.md).

---

## MVP

- [x] Anchor program on devnet with `init_hub`, `record_collection` (pays the picker in the same transaction), `ship_bale`, `confirm_intake` (recycler-signed, mints credits) and `claim_credits`; errors `ExceedsCollected`, `ExceedsIntake`, `AlreadyClaimed`; LiteSVM tests for each
- [x] Devnet USDC-style SPL payout from hub escrow, with a claimable account keyed by a phone hash for pickers without wallets
- [ ] AI grading: Claude vision returns polymer (PET/HDPE/mixed) and contamination %, which set ₦/kg; a perceptual-hash check rejects reused photos
- [x] Hub screen (mobile web): phone, weight, photo → grade → pay
- [x] Public ledger page: brand claim → credits → intake → bales → bags (photo hash, grade)
- [ ] Seed script: hub, recycler, two brands and about 15 real bag photos, so the demo replays the same way every time

## Stack

- **Program:** Anchor 1.2 (Rust), LiteSVM tests, Solana devnet, SPL Token
- **App:** Next.js 15 (App Router), React 19, TypeScript, Tailwind, pnpm (`app/`)
- **Client:** `@solana/kit` with a Codama-generated client from the program's IDL
- **AI:** Claude vision via `@anthropic-ai/sdk` (key in `app/.env.local`, never committed)
- **Photos:** `sharp` for perceptual hashes; paid photos in `app/.data/` on the hub; no database, the chain is the store

## Devnet

- Program: [`47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz`](https://explorer.solana.com/address/47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz?cluster=devnet)
- Demo hub: `Gm7y3vCkLiEHvxzPSxUfMLd8kcgTbJ7FcxktM6ERyU2i`, escrow `93MqjtctHhZTUt8EEZeMBQYAuFVHNorRBsNhYkBApbwg`
- tUSDC mint: `664ePnGgSywRELeAz2davzvyBAAyg1qewfFT7AfQxgeC`
- First paid bag: [`4N75Qo…Cku3`](https://explorer.solana.com/tx/4N75QorLLsxuvhXKLQAKyZCvSEYvLFTVSFpPuM84b58BebCpJ5SWQko3KQLdQg5GJHLNzfaRUjYP7NdDAnbyCku3?cluster=devnet)
- A double claim rejected by the program: [`51yieP…f7pJ`](https://explorer.solana.com/tx/51yiePXZJKvFXvQvSdzht5JxMfP4JjE84U1PNfatRq7uac5GX4XtsvN1vrcnfJ5DoWuyzrDBGqrzBLmX2aYQf7pJ?cluster=devnet)

## Run

```bash
anchor build --arch v1 && cargo test  # program + LiteSVM tests (always --arch v1)
pnpm install && pnpm setup:devnet   # devnet actors + tUSDC mint (idempotent; funds from your Solana CLI wallet)
pnpm generate:client                # IDL → app/src/generated/pickpay (after anchor build)
pnpm smoke:devnet                   # init hub, fund escrow, pay one bag on devnet
pnpm seed:demo                      # with the app running: grade + pay app/seed-photos, intake, Brand A claim
cd app && pnpm install && pnpm dev  # http://localhost:3000
cd app && pnpm test                 # pricing + perceptual-hash unit tests
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
- [x] Seed script replays the full demo on devnet (`pnpm seed:demo`: grade → pay → intake → Brand A claims 60%; `--dry-run`, `--base`; see `app/seed-photos/README.md`)
- [ ] Take about 15 real bag photos into `app/seed-photos/`, then run `pnpm seed:demo` with the key set

### M5 · Day 3 (2026-10-25): Judge docs (by 11:00 WAT)
- [x] Judge-facing README: problem, how it works, what's new, how to run (on its own merit, no competitor table)
- [x] Architecture diagram and technical spec (`docs/architecture.md`)
- [x] Security and data-integrity assessment (`docs/security.md`): threat model, including the limit that a hub can lie about weight and how intake caps it
- [x] 2-page problem and impact statement with cited CO2e figures, plus adoption and scalability roadmap (`docs/impact.md`)

### M6 · Day 3 (2026-10-25): Submit (by 13:00 WAT)
- [x] 3-minute video script (`docs/video-script.md`): grade and payout by 1:45, then the rejected double claim
- [ ] Record the video (needs the key and seeded photos) and upload it
- [x] Devpost text: track alignment, problem, solution, users, scale, adoption (`docs/devpost.md`)
- [ ] Make the repo public, then submit on Devpost

## Submission checklist

- [x] Track stated (Track 3) and how the project addresses it
- [ ] Project description: problem, solution, target users, how it scales, how easily it can be adopted
- [ ] Demo video, 3–5 min (aim for 3:00–3:30)
- [ ] Public GitHub repo with source and docs
- [ ] Working prototype (devnet program ID and app link or run steps)
- [x] Architecture diagram and technical spec
- [x] Security and data-integrity assessment
- [x] Problem statement (≤2 pages), climate impact assessment, adoption and scalability roadmap
- [ ] Submitted before 2026-10-25 15:00 WAT
