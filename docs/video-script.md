# Demo video script (target 3:15, hard limit 3:30)

**Setup before recording**

- App running (`cd app && pnpm dev`), `app/.env.local` has the API key, `pnpm seed:demo` has run so `/brand` shows a batch with credits left.
- Browser at 1280×800, dark mode, zoom 110%. Phone-width window (or devtools device mode, 390×844) for `/hub`.
- Tabs in order: `/hub` (phone width), `/brand`, the `/ledger/<claim>` link the seed printed, Solana Explorer.
- Fresh photo for scene 3: `app/demo-photos/video-pet-bales.jpg` (never seeded, so it grades and pays). Reused photo for scene 4: `app/seed-photos/02-hdpe-jerrycans.jpg` (already paid, so it's blocked). Scene 3 costs one grading call; scene 4 costs none.
- Note the batch's "left to claim" figure; Brand B's claim in scene 5 must be larger than it.
- Record screen and voice separately if you can; read the voiceover at an easy pace. The timings assume about 150 words per minute.

---

### 1 · The problem (0:00–0:25)

**On screen:** title card "PickPay: every kilo paid once, claimed once" → a photo of plastic in a Lagos drain or dump site (use a licensed or own photo) → the line "Lagos: ~870,000 t of plastic waste a year, ~13% recycled".

**Voiceover:**
> Lagos throws away around eight hundred and seventy thousand tonnes of plastic a year, and recycles a small fraction of it. The people who collect it are paid late, in cash, on scales nobody records. And from this year, Nigerian brands have to prove they recovered the plastic they sell. Today that proof is a spreadsheet.

### 2 · What PickPay is (0:25–0:45)

**On screen:** the flow diagram from the README: picker → hub → recycler → brand, with the four instruction names.

**Voiceover:**
> PickPay puts that whole chain on Solana. Pickers are paid the moment their bag is weighed. Recycling credits only exist once a recycler signs for the plastic. And each kilo can be claimed by exactly one brand. The program enforces it, not a server.

### 3 · Hub: grade and pay (0:45–1:45) — first wow

**On screen:** `/hub` at phone width. Type phone `0803 123 4567`, weight `6.2`, tap the photo box and pick the unused bag photo. Tap **Grade bag**. Pause on the grade card (polymer, contamination, note, ₦/kg × kg). Tap **Pay**. Hold on the green "Paid · confirmed in 0.8 s" card. Click the signature to open Explorer; show the transfer and the PickPay instruction.

**Voiceover:**
> This is the hub agent's phone. They enter the picker's number, the scale weight, and take a photo of the bag.
> Claude grades it: mostly clear PET bottles, a few percent contamination. That grade sets the price per kilo, so the picker gets the same fair rate every time.
> Pay. One transaction records the bag and pays the picker from the hub's escrow, confirmed in under a second. Here it is on Solana Explorer. The phone number never goes on-chain, only a salted hash.

### 4 · Reused photo (1:45–2:05)

**On screen:** "Next bag". Same phone, upload the already-seeded photo (or a resized copy of it). **Grade bag** → red error "This looks like the photo already paid for bag #N".

**Voiceover:**
> What if someone tries to get paid twice for the same bag? An exact copy is blocked on-chain by a photo seal. A resized or re-saved copy is caught by a perceptual hash, before we even spend an AI call.

### 5 · Brands: the double claim (2:05–2:50) — the main wow

**On screen:** `/brand`. Point at the batch: recycled kg, retired kg, left to claim. Select **Brand A**, enter a small amount (e.g. 1 kg), **Claim** → green "Brand A retired 1.0 kg". Select **Brand B**, enter more than what's left, **Claim** → red "Rejected by the program: AlreadyClaimed". Click "View failed transaction" → Explorer showing `AlreadyClaimed. Error Number: 6004`.

**Voiceover:**
> The hub ships a bale; the recycler weighs it and signs for what it accepted. Only that signature creates credits, and never more than the bale weighed.
> Brand A retires some against its producer-responsibility target. Now Brand B tries to claim kilos that are already gone.
> Rejected, by the program itself. This failed transaction is on-chain: AlreadyClaimed. Every kilo is paid for once and claimed once.

### 6 · Public ledger (2:50–3:05)

**On screen:** `/ledger/<claim>`: scroll from the claim through credits and bale to the bag cards; zoom on "matches the chain ✓".

**Voiceover:**
> And anyone can check it. This page traces a brand's claim back through the recycler to every bag, its grade, its payout, and a photo that matches the hash on-chain.

### 7 · Close (3:05–3:15)

**On screen:** end card: "PickPay · Track 3: Sustainable Supply Chains", repo URL, devnet program ID, "Pilot: one Lagos hub + one PET recycler".

**Voiceover:**
> Next is a pilot with one Lagos hub and one recycler, with real payouts. PickPay: every kilo paid once, claimed once.

---

**If you run long:** cut scene 4 to its on-screen error with no voiceover (saves about 12 s), and shorten scene 2 to its last sentence.

**Must stay in:** the payout confirming (scene 3) and the program rejecting Brand B (scene 5); they're what the judges will remember.
