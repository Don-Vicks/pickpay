// Writes out/<name>.srt from the beat list, so uploaded captions match the video exactly.
import { writeFileSync } from 'node:fs'
import { beatsFor, FPS, TRANSITION } from '../src/beats.ts'

const ts = (frames: number) => {
  const ms = Math.round((frames / FPS) * 1000)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}

for (const [cut, name] of [['full', 'pickpay-demo'], ['short', 'pickpay-demo-2min']] as const) {
  let start = 0
  const cues = beatsFor(cut).map((b, i) => {
    const text = b.kind === 'text' ? [b.eyebrow, b.title, b.sub].filter(Boolean).join(' — ') : b.caption
    const cue = `${i + 1}\n${ts(start + (i ? TRANSITION / 2 : 0))} --> ${ts(start + b.frames - TRANSITION / 2)}\n${text}\n`
    start += b.frames - TRANSITION
    return cue
  })
  writeFileSync(new URL(`../out/${name}.srt`, import.meta.url), cues.join('\n'))
  console.log(`wrote out/${name}.srt (${cues.length} cues)`)
}
