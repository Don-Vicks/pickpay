# Voiceover for the demo video (3:12)

Read this over `video/out/pickpay-demo.mp4`. Each line fits inside its scene at a relaxed pace (about 140 words a minute). The time on the left is when the scene starts; start the line as the scene appears.

## How to record

1. Open the video muted on one screen and this script on another (or print it).
2. Start a voice recording (QuickTime Player → File → New Audio Recording, or your phone's voice memo app), then press play on the video **at the same moment** and read along.
3. If you stumble, keep going and redo just that line at the end; or record the whole thing again, it's only 3 minutes.
4. Save the recording (`.m4a`, `.mp3` or `.wav`) and run `video/scripts/add-voice.sh <your file>`. It mixes your voice over the video with the music turned down, into `video/out/pickpay-demo-voice.mp4`.

Quiet room, phone or laptop about a hand's width from your mouth, speak a little slower than feels natural.

---

| Starts | On screen | Read |
|---|---|---|
| 0:00 | "870,000 tonnes" | Lagos throws away around eight hundred and seventy thousand tonnes of plastic a year. |
| 0:06 | "Pickers collect it." | The pickers who collect it get paid late, in cash, on weights nobody records. |
| 0:13 | "Brands now have to prove it…" | Now brands must prove their plastic was recycled. Today, that proof is a spreadsheet. |
| 0:20 | Title: PickPay | This is PickPay. Every kilo paid once, and claimed once. |
| 0:26 | Home page | It connects three people: the collection hub, the recycler, and the brand. Every step is a record on Solana that anyone can check. |
| 0:36 | Hub, empty form | Step one. A waste picker brings a bag to the hub. |
| 0:42 | Hub, form filled | The hub enters the picker's phone number and the weight on the scale, and takes a photo. |
| 0:49 | AI grade | AI looks at the photo: what kind of plastic it is, and how dirty. That sets a fair price per kilo, the same way every time. |
| 1:01 | Paid | The hub taps pay. One transaction records the bag and pays the picker, and it confirms in about a second. |
| 1:11 | Solana Explorer | Here it is on Solana Explorer. A real record, open to anyone. |
| 1:19 | Duplicate photo blocked | If someone tries to get paid twice with the same photo, even resized, it's blocked before the AI is even asked. |
| 1:28 | Recycler, bale sent | Step two. The hub sends its paid bags to a recycler as one bale, and the recycler weighs what arrives. |
| 1:38 | Recycler confirmed | Only the recycler's confirmation turns plastic into recycling credits, and never more than was actually sent. |
| 1:47 | Brand page | Step three. Brands must report recycled plastic, so they claim these kilos. |
| 1:55 | Brand A claimed | Brand A claims one kilo. Those kilos are now used up for everyone else. |
| 2:03 | Brand B asking | Now Brand B tries to claim fifteen kilos, but only four point nine are left. |
| 2:10 | Refused (red) | Refused. The same kilo can't count toward two brands' targets. |
| 2:17 | Program log | And that refusal comes from the program itself, on chain, not from our server. You can see the error right here: already claimed. |
| 2:28 | Public ledger | Anyone, a regulator, an auditor or a customer, can open a brand's claim and trace it back through the recycler to every bag: its grade, its payment, and its photo. |
| 2:42 | "Paid in seconds…" | So pickers are paid in seconds, the recycler's word is what counts, and every kilo is claimed once. |
| 2:52 | "≈ 660 t CO₂e a year" | One hub recovering a tonne of plastic bottles a day avoids roughly six hundred and sixty tonnes of CO2 a year. |
| 3:00 | End card | I'm Victor, and this is PickPay, built for the IEEE ClimateChain hackathon. Next: a pilot with one Lagos hub and one recycler. Thank you. |
