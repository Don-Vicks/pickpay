# PickPay

**Every kilo of plastic paid once, claimed once.**

PickPay pays waste pickers in Lagos within seconds for plastic that AI grades from a photo. A kilo becomes a recycling credit only after a recycler confirms it received the plastic, and exactly one brand can claim that credit toward its recycling target. A Solana program enforces both rules, and anyone can trace a brand's claim back to the bags it came from.

Built for the [IEEE ClimateChain Global Hackathon](https://ieee-climatechain-hack.devpost.com/), **Track 3: Sustainable Supply Chains**.

| | |
|---|---|
| Demo video (3 min) | https://youtu.be/wqHe-604t4c |
| Program on Solana devnet | [`47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz`](https://explorer.solana.com/address/47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz?cluster=devnet) |
| A double claim refused on-chain | [failed transaction, error 6004 `AlreadyClaimed`](https://explorer.solana.com/tx/51yiePXZJKvFXvQvSdzht5JxMfP4JjE84U1PNfatRq7uac5GX4XtsvN1vrcnfJ5DoWuyzrDBGqrzBLmX2aYQf7pJ?cluster=devnet) |
| Docs | [Architecture](docs/architecture.md) · [Security and data integrity](docs/security.md) · [Problem and climate impact](docs/impact.md) |
| All docs as one PDF | [docs/PickPay-submission.pdf](docs/PickPay-submission.pdf) |

## The problem

- **Collecting plastic doesn't pay reliably.** Nigeria generates about 2.5 million tonnes of plastic waste a year, about 870,000 tonnes of it in Lagos ([ThisDay, 2024](https://www.thisdaylive.com/2024/02/22/hazards-of-plastic-waste-in-nigeria/)). Lagos collects 48% of its municipal waste and recovers 8% ([UN-Habitat and LAWMA, 2021](https://www.africancleancities.org/sites/default/files/2023-06/facsheet-lagos.pdf)). Informal pickers do much of the collecting and are paid late, in cash, on weights nobody records.
- **Brands now have to prove recovery.** Nigeria's National Environmental (Plastic Waste Control) Regulations 2026 make producers and importers responsible for recovering the plastic they sell, and require PET packaging to contain 25% recycled PET by January 2028 ([ThisDay, Sept 2026](https://www.thisdaylive.com/2026/09/04/nigeria-tightens-war-on-plastic-waste-makes-producers-responsible-for-end-of-life-products/)).
- **Today's proof is a spreadsheet.** A brand's evidence is a report from the collector it paid. Nothing stops the same tonne being reported to two brands, or reported without ever reaching a recycler.

## How it works

```
picker ──bag──▶ HUB ──bale──▶ RECYCLER ──credits──▶ BRAND
                 │               │                    │
       AI grade + payout     weighs what arrived    claims kilos,
       in one transaction    and signs intake       once only
```

1. **Collect (hub, `/hub`).** The hub agent enters the picker's phone number and the scale weight, and photographs the bag. Claude vision grades the plastic type (PET, HDPE or mixed) and how dirty it is, which sets the price per kilo. **Pay** records the bag on Solana and pays the picker from the hub's escrow in the same transaction, confirmed in about a second. A picker without a wallet builds up a balance under a salted hash of their phone number.
2. **Recycle (recycler, `/recycler`).** The hub ships its paid bags as a bale. The recycler weighs what arrived and signs intake. That signature is the only thing that creates recycling credits, and never more than the bale's weight.
3. **Claim (brand, `/brand`).** A brand claims credits toward its recycling target. Claimed kilos are used up: a second claim on the same kilos is refused by the program, on-chain.
4. **Check (anyone, `/ledger`).** A regulator, auditor or customer can open any claim and follow it back through the recycler's intake and the bale to each paid bag, with its grade, payment and photo.

## What the program guarantees

Every instruction keeps one rule: **collected ≥ shipped ≥ credited ≥ claimed**.

| Instruction | Signed by | Refuses |
|---|---|---|
| `record_collection` | hub | zero weight (`ZeroWeight`), contamination out of range (`ContaminationOutOfRange`), a payout account on the wrong mint (`WrongMint`), a photo already used for another bag |
| `ship_bale` | hub | shipping more than was collected (`ExceedsCollected`) |
| `confirm_intake` | the recycler named on the bale | accepting more than the bale weighed (`ExceedsIntake`), any other signer (`WrongRecycler`), a second intake for the same bale |
| `claim_credits` | brand | claiming kilos that are already claimed (`AlreadyClaimed`) |

These rules hold whatever the app server or the AI does. The program has 11 LiteSVM tests that cover each of them. See [docs/security.md](docs/security.md) for the threat model and what is not yet protected, such as a hub and a recycler colluding.

## What makes it different

- **The recycler creates the credit, not the collector.** Collection data alone never creates a credit.
- **One claim per kilo.** Brands, auditors and regulators read the same accounts, so a tonne can't count toward two targets.
- **Payment and record can't drift apart.** The picker is paid in the same transaction that records the bag.
- **AI sets the price, and the server checks it.** The server signs the quote it computed, so a tampered request can't change the amount. A reused photo, even resized or recompressed, is blocked before the AI is asked.
- **No database.** Every screen reads Solana accounts. The hub keeps only the bag photos, and the ledger marks a photo as verified only when its SHA-256 matches the hash stored on-chain.

## Run it

Needs macOS or Linux, Node 24, pnpm, Rust, Anchor 1.2, the Agave 3.1 Solana CLI with a funded devnet wallet, and an Anthropic API key.

```bash
# Program: build and run the 11 LiteSVM tests (always --arch v1: Anchor 1.2 defaults to SBPF v3)
anchor build --arch v1 && cargo test

# Devnet: create the hub, recycler and brand wallets and a test-USDC mint, then the demo hub and its escrow
pnpm install
pnpm setup:devnet
pnpm smoke:devnet --init-only

# App
cd app
cp .env.example .env.local   # add ANTHROPIC_API_KEY
pnpm install
pnpm dev                     # http://localhost:3000
pnpm test                    # pricing and perceptual-hash unit tests

# Optional, from the repo root with the app running: replay the demo bags, bale, intake and Brand A's claim
pnpm seed:demo
```

Then open `/hub` to grade and pay a bag, `/recycler` to ship and confirm a bale, `/brand` to claim as Brand A and then watch Brand B's claim on the same kilos get refused, and `/ledger` to trace a claim.

After changing the program, run `pnpm generate:client` to regenerate the TypeScript client in `app/src/generated/pickpay`.

## What's real and what's a demo stand-in

- **Real:** the Anchor program on devnet; every payout, bale, intake and claim as a devnet transaction; Claude vision grading; the perceptual-hash duplicate check; the public ledger.
- **Demo stand-ins:**
  - Payouts use a test USDC token instead of USDC or naira.
  - There is one hub, one recycler and two brands, and the demo server holds their keys. In production each party signs on its own device.
  - The scale weight is typed in rather than read from a connected scale.
  - Pickers can't yet withdraw a phone-number balance, and there's no naira off-ramp or USSD.

## Repository

| Path | What's there |
|---|---|
| `programs/pickpay/` | Anchor program (Rust) and its LiteSVM tests |
| `app/` | Next.js app: hub, recycler, brand and ledger screens, plus the API routes |
| `scripts/` | Devnet setup, smoke test, demo seed, client generation, PDF build |
| `docs/` | Architecture, security, impact, the submission PDF, the video script |
| `video/` | Remotion source for the demo video |

## Stack

- **Program:** Anchor 1.2 (Rust), SPL Token, LiteSVM tests, Solana devnet
- **App:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Client:** `@solana/kit` with a Codama-generated client from the program's IDL
- **AI:** Claude vision (`claude-haiku-5-5`) through `@anthropic-ai/sdk`
- **Photos:** `sharp` for perceptual hashes; photos are stored on the hub, only their hashes go on-chain

## Devnet addresses

- Program: `47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz`
- Demo hub: `BiYZ3y3vNcHL4nRZBmBmpwnnLhMCY1TC2UqrSDWduSXp`, escrow `6ifasar11sHwUbKoKiV4kbo9w2yz1HNwTNuB3SuJN4SS`
- Test USDC mint: `664ePnGgSywRELeAz2davzvyBAAyg1qewfFT7AfQxgeC`

## What's next

1. **Pilot, months 1–3:** one Lagos hub and one PET recycler, real USDC payouts with a naira off-ramp, picker withdrawals and USSD for feature phones.
2. **Brands, months 3–6:** producer-responsibility organisations and brands claim credits for their reporting; monthly public reports come straight from the ledger.
3. **Network, months 6–12:** more hubs and recyclers, staked hubs whose bales a recycler can dispute, and connected scales that sign weights.

Details are in [docs/impact.md](docs/impact.md). The plan this was built against is in [docs/build-plan.md](docs/build-plan.md).
