# PickPay build plan

The plan PickPay was built against for the IEEE ClimateChain Global Hackathon (2026-10-23 to 2026-10-25), kept as a record. Everything here is done; the project overview is in the [README](../README.md).

## MVP

- [x] Anchor program on devnet with `init_hub`, `record_collection` (pays the picker in the same transaction), `ship_bale`, `confirm_intake` (recycler-signed, mints credits) and `claim_credits`; errors `ExceedsCollected`, `ExceedsIntake`, `AlreadyClaimed`; LiteSVM tests for each
- [x] Devnet USDC-style SPL payout from hub escrow, with a claimable account keyed by a phone hash for pickers without wallets
- [x] AI grading: Claude vision returns polymer (PET/HDPE/mixed) and contamination %, which set ₦/kg; a perceptual-hash check rejects reused photos
- [x] Hub screen (mobile web): phone, weight, photo → grade → pay
- [x] Public ledger page: brand claim → credits → intake → bales → bags (photo hash, grade)
- [x] Seed script: hub, recycler, two brands and real bag photos (4 openly licensed Commons photos, credited in `app/seed-photos/CREDITS.md`), so the demo replays the same way every time

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
- [x] `/api/grade`: Claude vision → polymer and contamination → ₦/kg and USDC amount (live on real photos: PET, HDPE and mixed graded and paid; a non-plastic image is rejected; garden waste in plastic sacks grades as very dirty mixed plastic)
- [x] Hub screen: phone, weight, photo → grade → "Pay" sends `record_collection` and shows the confirmed transaction (`/hub` + `/api/collect`; Pay verified on devnet in 0.8 s)
- [x] Brand screen: claim credits; a second brand claiming the same credits shows the live `AlreadyClaimed` rejection (`/brand`; the rejected claim lands on devnet as a failed tx, error 6004)

### M4 · Day 2 (2026-10-24): Ledger and fraud (scope freeze 22:00 WAT)
- [x] Perceptual-hash duplicate-photo check that blocks a reused photo (64-bit dHash via sharp, ≤10 bits = same photo; checked in `/api/grade` before the AI call and again in `/api/collect`; index in `app/.data/`, exact SHA-256 still sealed on-chain)
- [x] Public ledger page `/ledger/[claim]` tracing claim → credits → intake → bales → bags (all from devnet accounts; `/ledger` lists claims; hub photos shown only when their SHA-256 matches the chain)
- [x] Seed script replays the full demo on devnet (`pnpm seed:demo`: grade → pay → intake → Brand A claims 60%; `--dry-run`, `--base`; see `app/seed-photos/README.md`)
- [x] Real bag photos in `app/seed-photos/` and `pnpm seed:demo` run on devnet (openly licensed photos to save API credits: 4 bags paid, 1 rejected, Brand A retired 13.7 kg; the Ikeja photo was later dropped because it shows people, so bag #8 shows no photo; `app/demo-photos/` holds an unused photo for the video)

### M5 · Day 3 (2026-10-25): Judge docs (by 11:00 WAT)
- [x] Judge-facing README: problem, how it works, what's new, how to run (on its own merit, no competitor table)
- [x] Architecture diagram and technical spec (`docs/architecture.md`)
- [x] Security and data-integrity assessment (`docs/security.md`): threat model, including the limit that a hub can lie about weight and how intake caps it
- [x] 2-page problem and impact statement with cited CO2e figures, plus adoption and scalability roadmap (`docs/impact.md`)

### M6 · Day 3 (2026-10-25): Submit (by 13:00 WAT)
- [x] 3-minute video script (`docs/video-script.md`): grade and payout by 1:45, then the rejected double claim
- [x] Record the video (`video/`, Remotion from real devnet screens, with an original soundtrack: `video/out/pickpay-demo.mp4`, 3:12)
- [x] Record the voiceover from `docs/voiceover.md` and mix it in (`video/out/pickpay-demo-voice.mp4`, 3:15)
- [x] Upload the video (YouTube, unlisted: https://youtu.be/wqHe-604t4c) and add its link to the README and `docs/devpost.md`
- [x] Devpost text: track alignment, problem, solution, users, scale, adoption (`docs/devpost.md`)
- [x] Make the repo public (https://github.com/Don-Vicks/pickpay)
- [x] Submit on Devpost

## Submission checklist

- [x] Track stated (Track 3) and how the project addresses it
- [x] Project description: problem, solution, target users, how it scales, how easily it can be adopted
- [x] Demo video, 3–5 min (https://youtu.be/wqHe-604t4c, 3:16)
- [x] Public GitHub repo with source and docs (https://github.com/Don-Vicks/pickpay)
- [x] Working prototype (devnet program ID and app link or run steps)
- [x] Architecture diagram and technical spec
- [x] Security and data-integrity assessment
- [x] Problem statement (≤2 pages), climate impact assessment, adoption and scalability roadmap
- [x] Submitted before 2026-10-25 15:00 WAT
