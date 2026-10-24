# Devpost submission text

Paste each section into the matching Devpost field. Replace the bracketed links before submitting.

---

## Project name

PickPay

## Tagline

Every kilo of plastic paid once, claimed once: instant pay for waste pickers and recycling credits that only one brand can claim.

## Track

**Track 3: Sustainable Supply Chains.** PickPay is a recycling traceability system and a circular-economy incentive: it pays the people who collect plastic the moment their bag is weighed, and it turns each recycled kilo into a credit that is traceable from the brand's claim back to the bag, and can be claimed only once. It also addresses Track 1's double-counting problem, applied to plastic recovery credits.

## Inspiration

Lagos produces an estimated 870,000 tonnes of plastic waste a year and recycles a small share of it. Much of what is recovered is gathered by informal pickers who sell by weight and are paid late, in cash, on scales nobody records. At the same time, Nigeria's 2026 plastic waste regulations make producers responsible for recovering what they sell. Their evidence today is a report from whoever they paid, and nothing stops the same tonne being counted twice. I wanted the person who picks up the bottle and the brand that has to prove it was recycled to look at the same record.

## What it does

- **Hub** (a phone screen at a collection point): the agent enters the picker's phone number and the scale weight and photographs the bag. Claude vision grades the plastic (PET, HDPE or mixed) and its contamination, which sets the price per kilo. One Solana transaction records the bag and pays the picker from the hub's escrow, confirmed in about a second. Pickers without a wallet build up a balance under a salted hash of their phone number; the number never goes on-chain.
- **Recycler:** when the hub ships a bale, only the receiving recycler's signature creates recovery credits, and never more than the bale weighed.
- **Brand:** retires credits against its producer-responsibility target. A second claim on kilos already retired is rejected by the program, on-chain.
- **Public ledger:** anyone can trace a brand's claim through the recycler's intake and the bale to every bag, with its grade, payout and a photo whose hash matches the chain.
- **Fraud checks:** an exact reused photo is blocked on-chain; a resized or re-saved copy is caught by a perceptual hash before grading; the payout amount is signed by the server so it can't be edited in the browser.

## How I built it

- **Solana program (Anchor 1.2, Rust):** accounts for hubs, bags, photo seals, pickers, bales, credit batches and claims. Five instructions enforce one rule: collected ≥ shipped ≥ credited ≥ claimed. The picker payout is an SPL token transfer inside the instruction that records the bag. 11 LiteSVM tests cover every rejection path; deployed to devnet.
- **App (Next.js 15, React 19, TypeScript, Tailwind):** hub, brand and ledger screens; a `@solana/kit` client generated from the program's IDL with Codama. There is no database: every screen reads chain state.
- **AI grading:** Claude (`claude-opus-5-5`) returns a strict JSON grade against a fixed rubric; pricing is deterministic integer maths on top of it.
- **Duplicate detection:** SHA-256 photo seals on-chain plus a 64-bit perceptual hash (`sharp`) on the hub.

## Challenges I ran into

- Anchor 1.2 compiles for SBPF v3 by default, which the test VM couldn't load; building for v1 fixed it and also deploys to devnet.
- Making a rejected claim visible as the program's own decision: claims are sent without preflight so a double claim lands on-chain as a failed transaction with the `AlreadyClaimed` error, instead of being stopped quietly by the server.
- Keeping AI in the loop without trusting it with money: the model only grades; the server computes and signs the price, and the price can't exceed the clean rate for the weight.
- Being honest about what a ledger can't prove: a hub can still misreport a weight. The recycler's independent intake caps what that can turn into, and the security write-up names collusion as the main open risk.

## Accomplishments I'm proud of

- A picker payout confirmed on devnet in under a second, from a phone screen.
- A double claim rejected on-chain by the program ([failed transaction](https://explorer.solana.com/tx/51yiePXZJKvFXvQvSdzht5JxMfP4JjE84U1PNfatRq7uac5GX4XtsvN1vrcnfJ5DoWuyzrDBGqrzBLmX2aYQf7pJ?cluster=devnet)).
- A public trace from a brand's claim to individual bags, built from chain state alone.

## What I learned

The hard part of recycling credits isn't recording data; it's deciding whose signature creates value. Putting that signature on the recycler, and the payout inside the same transaction as the bag, made most of the fraud cases simple to reason about.

## What's next

1. **Pilot (months 1–3):** one Lagos collection hub and one PET recycler, real USDC payouts with a naira off-ramp, picker withdrawals and USSD for feature phones, and measuring the AI grade against what the recycler accepts.
2. **Brands (months 3–6):** a producer-responsibility organisation or brand claiming credits for EPR reporting, paying a fee per verified tonne.
3. **Network (months 6–12):** ten hubs, staked hubs whose bales a recycler can dispute, and scales that sign weights.

**Target users:** waste pickers and collection hubs in Lagos, PET recyclers, and brands and producer-responsibility organisations with obligations under Nigeria's 2026 plastic waste regulations.
**How it scales:** hubs are independent on-chain accounts that write in parallel; each bag costs about 0.0033 SOL of reclaimable rent. **How easily it's adopted:** a hub needs a phone, its existing scale and a payout float; nothing about the physical flow of plastic changes.
**Climate impact:** at a conservative ~2.2 kg CO2e avoided per kg of recycled PET, one hub recovering a tonne a day avoids about 660 t CO2e a year; ten hubs, about 6,600 t (assumptions and sources in `docs/impact.md`).

## Built with

solana, anchor, rust, typescript, next.js, react, tailwindcss, claude, anthropic-api, solana-kit, codama, litesvm, sharp, spl-token

## Links

- **Code:** [GitHub repo URL]
- **Demo video:** [YouTube or Vimeo URL]
- **Program on devnet:** https://explorer.solana.com/address/47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz?cluster=devnet
- **Docs:** architecture, security and data integrity, problem and impact (in the repo's `docs/` folder)
