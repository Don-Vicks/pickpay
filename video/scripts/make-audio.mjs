// Synthesises the video's audio from scratch, so there is nothing to license:
// an ambient score (pads on Am–F–C–G, soft arpeggio, sub bass) plus three short effects.
// Writes WAVs, then ffmpeg turns them into small .m4a files in public/audio.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SR = 44100
const OUT = join(new URL('..', import.meta.url).pathname, 'public/audio')
mkdirSync(OUT, { recursive: true })

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)
const TAU = Math.PI * 2

// Deterministic noise so the output is the same on every run.
let seed = 12345
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1

function writeWav(name, left, right) {
  const n = left.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  const gain = peak > 0 ? 0.5 / peak : 1 // normalise to about -6 dBFS
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * gain)) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * gain)) * 32767), 46 + i * 4)
  }
  const wav = join(OUT, `${name}.wav`)
  writeFileSync(wav, buf)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '160k', join(OUT, `${name}.m4a`)])
  rmSync(wav)
  console.log(`wrote public/audio/${name}.m4a`)
}

// ---------- Score ----------
function score(seconds) {
  const n = Math.round(seconds * SR)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const chordLen = 4 // seconds per chord
  const chords = [
    [57, 60, 64, 69], // Am
    [53, 57, 60, 65], // F
    [48, 55, 60, 64], // C
    [55, 59, 62, 67], // G
  ]
  const roots = [45, 41, 36, 43]

  // Pads: each chord swells in and out, overlapping its neighbours for smooth changes.
  for (let c = 0; c * chordLen < seconds + chordLen; c++) {
    const notes = chords[c % 4]
    const start = (c * chordLen - 1) * SR
    const len = (chordLen + 2) * SR
    for (let k = 0; k < notes.length; k++) {
      const f = hz(notes[k])
      for (let j = 0; j < len; j++) {
        const i = start + j
        if (i < 0 || i >= n) continue
        const t = j / SR
        const env = Math.sin((Math.PI * j) / len) ** 2 // smooth swell
        const v = Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 2 * t) + 0.08 * Math.sin(TAU * f * 3 * t)
        const detune = Math.sin(TAU * f * 1.003 * t) // slight chorus on the right
        L[i] += 0.05 * env * v
        R[i] += 0.05 * env * (0.6 * v + 0.4 * detune)
      }
    }
    // Sub bass on the root.
    const fb = hz(roots[c % 4])
    for (let j = 0; j < len; j++) {
      const i = start + j
      if (i < 0 || i >= n) continue
      const env = Math.sin((Math.PI * j) / len) ** 2
      const v = 0.07 * env * Math.sin(TAU * fb * (j / SR))
      L[i] += v
      R[i] += v
    }
  }

  // Arpeggio: soft plucks on eighth notes at 80 bpm, entering after the intro.
  const step = 60 / 80 / 2
  for (let s = 0; s * step < seconds; s++) {
    const t0 = s * step
    if (t0 < 8 || t0 > seconds - 6) continue
    const notes = chords[Math.floor(t0 / chordLen) % 4]
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    const f = hz(notes[pattern[s % 8]] + 12)
    const pan = (s % 2 ? 0.35 : -0.35)
    const start = Math.round(t0 * SR)
    const len = Math.round(0.9 * SR)
    for (let j = 0; j < len && start + j < n; j++) {
      const t = j / SR
      const env = Math.exp(-t * 5) * Math.min(1, t * 200)
      const v = 0.035 * env * (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t))
      L[start + j] += v * (1 - pan)
      R[start + j] += v * (1 + pan)
    }
  }

  // Gentle low-pass, then master fades.
  let l = 0, r = 0
  const a = 0.18
  for (let i = 0; i < n; i++) {
    l += a * (L[i] - l); r += a * (R[i] - r)
    const t = i / SR
    const fade = Math.min(1, t / 3, (seconds - t) / 5)
    L[i] = l * Math.max(0, fade)
    R[i] = r * Math.max(0, fade)
  }
  return [L, R]
}

// ---------- Effects ----------
function whoosh() {
  const n = Math.round(0.7 * SR)
  const L = new Float32Array(n), R = new Float32Array(n)
  let y = 0
  for (let i = 0; i < n; i++) {
    const t = i / n
    const cutoff = 0.02 + 0.25 * Math.sin(Math.PI * t) // filter opens then closes
    y += cutoff * (rand() - y)
    const env = Math.sin(Math.PI * t) ** 2
    L[i] = y * env * (1 - t * 0.6)
    R[i] = y * env * (0.4 + t * 0.6)
  }
  return [L, R]
}

function tones(notes, { decay, gap, harmonics }) {
  const n = Math.round((gap * notes.length + 1.2) * SR)
  const L = new Float32Array(n), R = new Float32Array(n)
  notes.forEach((m, k) => {
    const f = hz(m)
    const start = Math.round(k * gap * SR)
    for (let j = 0; start + j < n; j++) {
      const t = j / SR
      const env = Math.exp(-t * decay) * Math.min(1, t * 300)
      let v = 0
      harmonics.forEach((h, idx) => (v += h * Math.sin(TAU * f * (idx + 1) * t)))
      L[start + j] += v * env
      R[start + j] += v * env
    }
  })
  return [L, R]
}

writeWav('score', ...score(200))
writeWav('whoosh', ...whoosh())
writeWav('chime', ...tones([88, 93], { decay: 4, gap: 0.12, harmonics: [1, 0.2, 0.05] })) // E6 → A6
writeWav('refused', ...tones([57, 53], { decay: 3, gap: 0.22, harmonics: [1, 0.5, 0.3, 0.15] })) // A3 → F3
