# Demo bag photos

Drop 10–15 real photos of bags of plastic here (`.jpg`, `.png` or `.webp`, under 5 MB each), then run `pnpm seed:demo` from the repo root with the app running.

Shoot a mix so the grades differ:

- clear PET water and soft-drink bottles (clean, and one sandy or wet)
- opaque HDPE containers (detergent, oil jerrycans, milk)
- a mixed bag with sachets or films
- one photo that isn't plastic (to show the "not plastic" rejection)

Optional `manifest.json` sets the scale weight and picker for a photo; anything not listed gets a stable default:

```json
[
  { "file": "bag-01.jpg", "weightKg": 6.2, "phone": "0803 123 4567" },
  { "file": "bag-02.jpg", "weightKg": 4.8, "phone": "0806 555 0101", "wallet": "<Solana address>" }
]
```

Every photo is graded by the real `/api/grade` (needs `ANTHROPIC_API_KEY` in `app/.env.local`) and paid on devnet. Re-running skips photos that were already paid: the duplicate check catches them.
