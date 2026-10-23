# PickPay: build rules

- **Event:** IEEE ClimateChain Global Hackathon, Track 3 (Sustainable Supply Chains). https://ieee-climatechain-hack.devpost.com/
- **Deadline:** **Sun 2026-10-25 15:00 WAT** (GMT+1, per Devpost). Submit by 13:00 WAT. Scope freeze Sat 2026-10-24 22:00 WAT.
- **Judging:** climate impact 30%, blockchain implementation 30%, feasibility, data security and transparency, UX, scalability (10% each). The judges are blockchain and security academics, so the on-chain invariant and the security doc matter.
- **Research and idea notes:** /Users/donvicks/Developer/projects/opportunity-engine/data/notes/devpost-29114.md

## Scope rule

MVP first. Build nothing outside the README's `## MVP` list until every MVP box is ticked. No naira off-ramp, USSD, auth system or database. The chain is the store.

## The loop

1. Read README.md.
2. Do the first unticked task under `## Plan`.
3. Run it to prove it works (`anchor build && cargo test` for the program; `pnpm dev` / `pnpm build` in `app/` for the app).
4. Tick it in README.md.
5. Commit with a conventional message (`feat:`, `fix:`, `docs:`, `test:`).

## Layout

- `programs/pickpay/`: Anchor 1.2 program; tests in `programs/pickpay/tests/` (LiteSVM)
- `app/`: Next.js 15 app (pnpm)
- `scripts/`: devnet setup and seed scripts
- `docs/`: architecture, security, impact

## Constraints

- The invariant is **collected ≥ shipped ≥ credited ≥ claimed**. Every instruction must keep it, and every error path needs a test.
- Never put picker phone numbers on-chain. Store only a salted hash.
- Secrets (`app/.env.local`, keypairs) are never committed. The user adds the Anthropic API key themselves.
- Ask before adding dependencies outside the README's Stack section.
- No agriculture or farm-traceability features (employer NDA).
