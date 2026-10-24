# Problem, climate impact and roadmap

## Problem statement

Nigeria generates an estimated 2.5 million tonnes of plastic waste a year, about 870,000 tonnes of it in Lagos ([ThisDay, 2024](https://www.thisdaylive.com/2024/02/22/hazards-of-plastic-waste-in-nigeria/)). A 2021 survey by UN-Habitat and the Lagos Waste Management Authority found that Lagos collects 48% of its municipal solid waste, handles 8% in controlled facilities and recovers 8% for recycling; the rest is left uncollected or dumped ([UN-Habitat Waste Wise Cities factsheet, Lagos](https://www.africancleancities.org/sites/default/files/2023-06/facsheet-lagos.pdf)). These figures are estimates; Nigerian waste data is thin, and the sources say so.

Two things keep plastic from reaching recyclers:

1. **Collection doesn't pay reliably.** Informal pickers gather much of what is recovered, sell by weight to middlemen, and are paid in cash, late, on scales nobody records. Recyclers report they can't get enough feedstock even when they pay anyone who brings it ([Africa Live](https://africalive.net/article/fighting-plastic-waste-a-double-edged-sword/)).
2. **Producers now owe proof, and the proof is weak.** The National Environmental (Plastic Waste Control) Regulations 2026 make producers and importers responsible for recovering the plastic they sell, and require PET packaging to contain 25% recycled PET by January 2028 and 50% after that ([ThisDay, Sept 2026](https://www.thisdaylive.com/2026/09/04/nigeria-tightens-war-on-plastic-waste-makes-producers-responsible-for-end-of-life-products/)). A brand's evidence today is a report from the collector it paid. Nothing stops the same tonne being reported to two brands, or reported without ever reaching a recycler.

## Solution

PickPay connects the two. A hub weighs and photographs each bag; AI grades it; the picker is paid in the same Solana transaction that records the bag. When the hub ships a bale, only the receiving recycler's signature creates recovery credits, capped at the bale's weight. Brands retire those credits against their EPR obligations, and the program rejects any claim on kilos already retired. Anyone can trace a claim back to the bags it came from.

**Users and who pays**

| User | Gets | Pays |
|---|---|---|
| Waste pickers | Payment in seconds at a fair, consistent grade-based price; a record of their work | Nothing |
| Collection hubs (buy-back centres) | Faster throughput, no cash handling, a public track record | Nothing in the pilot; a small fee per tonne later |
| Recyclers | More and cleaner feedstock, graded before it arrives | Nothing |
| Brands and producer-responsibility organisations | EPR evidence regulators and auditors can check without trusting a vendor | A fee per verified tonne claimed |

## Climate impact assessment

**How PickPay reduces emissions:** every kilo of PET that reaches a recycler instead of a dump or a fire (a) displaces virgin PET resin and (b) avoids the emissions of open burning and dumping. Only (a) is counted below, because it is the better-measured of the two.

**Evidence:** NAPCOR's life-cycle analysis (Franklin Associates, 2020) finds that replacing virgin PET with recycled PET cuts greenhouse-gas emissions by about 60% ([Recycling Today](https://www.recyclingtoday.com/Article/napcor-pet-life-cycle-analysis-calculator)). A per-kilo estimate puts virgin PET at about 6.5 kg CO2e/kg and recycled PET at 4.3 kg CO2e/kg ([Carbonfact](https://www.carbonfact.com/materials/pet)), a saving of about **2.2 kg CO2e per kg** recycled. That source's boundaries are unverified and its 34% saving is more conservative than NAPCOR's 60%, so it is used here as the conservative figure.

**Projection (illustrative, conservative assumptions):**

| Scenario | PET recovered per year | CO2e avoided per year | Paid to pickers per year |
|---|---|---|---|
| One pilot hub, 1 t/day, 300 days | 300 t | ≈ 660 t | ≈ ₦90m at ₦300/kg |
| 10 hubs in Lagos | 3,000 t | ≈ 6,600 t | ≈ ₦900m |
| 100 hubs across Nigeria | 30,000 t | ≈ 66,000 t | ≈ ₦9bn |

Assumptions: PET only (HDPE and mixed plastic not counted), the conservative 2.2 kg CO2e/kg saving, avoided burning and dumping not counted, prices at the demo rate of ₦300/kg for clean PET. Ten hubs would recover about 0.3% of Lagos's plastic waste, so the impact depends on growing the network, not on one site. The ledger itself is the measurement: every figure in this table becomes an on-chain number once hubs are live.

**User testing:** none yet. The first pilot (below) is where it happens; the metrics to track are payment time, grade agreement with recycler intake, the collected-to-accepted gap per hub, and picker retention.

## Adoption strategy

1. **Start where the plastic already moves.** Lagos already has buy-back centres and aggregators. PickPay replaces their cash box and notebook with a phone, a scale and a payout float; nothing about the physical flow changes.
2. **Recyclers first among the institutions.** Recyclers want steadier, graded feedstock and lose nothing by signing intake; their signature is what makes the credits valuable.
3. **Brands follow the evidence.** Under the 2026 regulations, producers and their producer-responsibility organisations need recovery evidence they can defend. A per-tonne fee for verified, single-claim credits funds hub floats and operations.
4. **Pickers without bank accounts or smartphones** are paid to a balance tied to their phone number; a withdrawal flow, a naira off-ramp and USSD come in the pilot.

## Scalability and sustainability roadmap

| Phase | When | What |
|---|---|---|
| Pilot | Months 1–3 | One Lagos hub and one PET recycler; real USDC payouts with a naira off-ramp; picker withdrawals and USSD; grade accuracy measured against recycler intake |
| Brands | Months 3–6 | First producer-responsibility organisation or brand claiming credits; monthly public reports generated from the ledger; per-tonne fee live |
| Network | Months 6–12 | 10 hubs and 2–3 recyclers; staked hubs with slashing on disputed bales; scales that sign weights; an indexer for chain reads |
| Beyond | Year 2 | Other waste streams (HDPE, e-waste, batteries) on the same attestation pattern; other West African cities |

**Technical scaling:** hubs are independent accounts, so they write in parallel; each bag costs about 0.0033 SOL of reclaimable rent and one transaction fee. **Financial sustainability:** brand fees per verified tonne cover hub floats and operating costs; pickers and recyclers pay nothing.
