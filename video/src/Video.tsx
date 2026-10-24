import { loadFont } from '@remotion/google-fonts/Geist'
import { fade } from '@remotion/transitions/fade'
import { linearTiming, TransitionSeries } from '@remotion/transitions'
import {
  AbsoluteFill,
  Html5Audio,
  Easing,
  Sequence,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { beatsFor, TRANSITION, type Beat, type Mark } from './beats'
import CLIPS_JSON from '../public/clips/manifest.json'
import STILLS_JSON from '../public/stills/manifest.json'

const CLIPS = CLIPS_JSON as unknown as Record<string, { duration: number; marks: Mark[] }>
const STILLS = STILLS_JSON as unknown as Record<string, { width: number; height: number; marks: Mark[] }>

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] })

const C = {
  bg: '#0a0a0a',
  panel: '#141414',
  border: 'rgba(255,255,255,0.10)',
  text: '#f5f5f5',
  muted: 'rgba(245,245,245,0.66)',
  accent: '#10b981',
  accentDeep: '#059669',
}

const ease = Easing.bezier(0.33, 1, 0.68, 1)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Soft emerald glow that drifts slowly, so resting frames never look frozen. */
function Backdrop() {
  const frame = useCurrentFrame()
  const x = 30 + Math.sin(frame / 140) * 8
  const y = 20 + Math.cos(frame / 170) * 6
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at ${x}% ${y}%, rgba(16,185,129,0.16), transparent 60%), radial-gradient(900px 700px at 85% 90%, rgba(16,185,129,0.07), transparent 60%), ${C.bg}`,
      }}
    />
  )
}

function useEnter(delay = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping: 200 } })
}

// Layout: the app fills the top 1920x912; a caption bar (step + caption) sits underneath.
const APP_W = 1920
const APP_H = 912

function Bar({ step, text }: { step?: string; text: string }) {
  const p = useEnter(6)
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: APP_H,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '0 56px',
        background: 'linear-gradient(180deg, #0d1411, #0a0a0a)',
        borderTop: '1px solid rgba(16,185,129,0.35)',
      }}
    >
      {step && (
        <div
          style={{
            flexShrink: 0,
            padding: '10px 20px',
            borderRadius: 999,
            background: 'rgba(16,185,129,0.14)',
            border: '1px solid rgba(16,185,129,0.45)',
            color: C.accent,
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {step}
        </div>
      )}
      <div
        style={{
          flex: 1,
          color: C.text,
          fontSize: 44,
          fontWeight: 600,
          lineHeight: 1.15,
          opacity: p,
          transform: `translateY(${(1 - p) * 14}px)`,
        }}
      >
        {text}
      </div>
    </div>
  )
}

/** Fades a highlight in over 8 frames after `at` and out over 8 frames before `until` (seconds). */
function markOpacity(frame: number, fps: number, m: Mark) {
  return interpolate(frame / fps, [m.at, m.at + 0.27, m.until - 0.27, m.until], [0, 1, 1, 0], clamp)
}

/**
 * Content (a clip or a still) laid out in `box`, with highlight boxes and an optional push-in on
 * the highlighted element. `marks` are in 0..1 of the content and seconds of scene time.
 */
function Stage({ box, marks, children }: { box: { x: number; y: number; w: number; h: number }; marks: Mark[]; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // Push in toward the zooming mark that is currently showing.
  let scale = 1
  let ox = 0.5
  let oy = 0.5
  for (const m of marks) {
    if (m.zoom <= 1) continue
    const k = interpolate(frame / fps, [m.at, m.at + 0.6, m.until - 0.6, m.until], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) })
    if (k > 0) {
      scale = 1 + (m.zoom - 1) * k
      ox = m.x + m.w / 2
      oy = m.y + m.h / 2
    }
  }
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: APP_W, height: APP_H, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          transform: `scale(${scale})`,
          transformOrigin: `${ox * 100}% ${oy * 100}%`,
        }}
      >
        {children}
        {marks.map((m, i) => {
          const o = markOpacity(frame, fps, m)
          if (o <= 0) return null
          return (
            <div key={i} style={{ position: 'absolute', left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%`, opacity: o }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 14,
                  border: `${4 / scale}px solid #34d399`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.38), 0 0 40px rgba(52,211,153,0.55)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: '100%',
                  marginBottom: 10 / scale,
                  padding: `${6 / scale}px ${14 / scale}px`,
                  borderRadius: 10 / scale,
                  background: '#34d399',
                  color: '#04130c',
                  fontSize: 26 / scale,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {m.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ClipBeatT = Extract<Beat, { kind: 'clip' }>
type StillBeatT = Extract<Beat, { kind: 'still' }>

function ClipBeat({ beat }: { beat: ClipBeatT & { frames: number } }) {
  const { fps } = useVideoConfig()
  const from = beat.from ?? 0
  const marks = (CLIPS[beat.clip]?.marks ?? [])
    .map((m) => ({ ...m, at: m.at - from, until: m.until - from }))
    .filter((m) => m.until > 0 && m.at < beat.frames / fps)
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Stage box={{ x: 0, y: 0, w: APP_W, h: APP_H }} marks={marks}>
        <OffthreadVideo src={staticFile(`clips/${beat.clip}.mp4`)} startFrom={Math.round(from * fps)} muted style={{ width: APP_W, height: APP_H }} />
      </Stage>
      <Bar step={beat.step} text={beat.caption} />
    </AbsoluteFill>
  )
}

function StillBeat({ beat }: { beat: StillBeatT }) {
  const meta = STILLS[beat.still]
  const p = useEnter()
  // Fit the crop inside the app area with a margin, centred.
  const k = Math.min((APP_W - 160) / meta.width, (APP_H - 120) / meta.height)
  const w = meta.width * k
  const h = meta.height * k
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ opacity: p }}>
        <Stage box={{ x: (APP_W - w) / 2, y: (APP_H - h) / 2, w, h }} marks={meta.marks}>
          <Img src={staticFile(`stills/${beat.still}.png`)} style={{ width: w, height: h, borderRadius: 18 }} />
        </Stage>
      </div>
      <Bar step={beat.step} text={beat.caption} />
    </AbsoluteFill>
  )
}

function TextBeat({ beat }: { beat: Extract<Beat, { kind: 'text' }> }) {
  const eyebrow = useEnter(4)
  const title = useEnter(14)
  const sub = useEnter(30)
  const isBig = beat.title.length <= 22
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 180px', textAlign: 'center' }}>
      {beat.eyebrow && (
        <div style={{ color: C.accent, fontSize: 32, fontWeight: 600, letterSpacing: 1, opacity: eyebrow, transform: `translateY(${(1 - eyebrow) * 16}px)` }}>
          {beat.eyebrow}
        </div>
      )}
      <div
        style={{
          marginTop: 18,
          color: beat.accent === beat.title ? C.accent : C.text,
          fontSize: isBig ? 150 : 84,
          fontWeight: 700,
          letterSpacing: isBig ? -4 : -1.5,
          lineHeight: 1.05,
          opacity: title,
          transform: `translateY(${(1 - title) * 30}px)`,
        }}
      >
        {beat.title}
      </div>
      {beat.sub && (
        <div style={{ marginTop: 28, maxWidth: 1300, color: C.muted, fontSize: 44, lineHeight: 1.3, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
          {beat.sub}
        </div>
      )}
    </AbsoluteFill>
  )
}

/** Thin progress bar along the bottom edge. */
function Progress() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  return (
    <div style={{ position: 'absolute', left: 0, bottom: 0, height: 5, width: `${(frame / durationInFrames) * 100}%`, background: C.accentDeep, opacity: 0.8 }} />
  )
}

// Sound effects keyed to beats: [beat id, file, delay in frames, volume].
const SFX: [string, string, number, number][] = [
  ['title', 'whoosh', 0, 0.35],
  ['hub-empty', 'whoosh', 0, 0.3],
  ['hub-paid', 'chime', 14, 0.5],
  ['recycler-bale', 'whoosh', 0, 0.3],
  ['brand', 'whoosh', 0, 0.3],
  ['brand-a', 'chime', 18, 0.3],
  ['brand-b-result', 'refused', 8, 0.55],
  ['ledger', 'whoosh', 0, 0.3],
]

function Soundtrack({ starts }: { starts: Map<string, number> }) {
  const { durationInFrames, fps } = useVideoConfig()
  return (
    <>
      <Html5Audio
        src={staticFile('audio/score.m4a')}
        // Bed sits under the captions; fades out over the last 4 seconds of either cut.
        volume={(f) => 0.6 * Math.min(1, Math.max(0, (durationInFrames - f) / (4 * fps)))}
      />
      {SFX.filter(([id]) => starts.has(id)).map(([id, file, delay, volume]) => (
        <Sequence key={`${id}-${file}`} from={starts.get(id)! + delay} durationInFrames={2 * fps}>
          <Html5Audio src={staticFile(`audio/${file}.m4a`)} volume={volume} />
        </Sequence>
      ))}
    </>
  )
}

export function Demo({ cut }: { cut: 'full' | 'short' }) {
  const beats = beatsFor(cut)
  // Frame where each beat starts, accounting for the crossfade overlap.
  const starts = new Map<string, number>()
  beats.reduce((at, b) => (starts.set(b.id, at), at + b.frames - TRANSITION), 0)
  return (
    <AbsoluteFill style={{ fontFamily, color: C.text }}>
      <Backdrop />
      <TransitionSeries>
        {beats.flatMap((b, i) => [
          <TransitionSeries.Sequence key={b.id} durationInFrames={b.frames} premountFor={30}>
            {b.kind === 'text' ? <TextBeat beat={b} /> : b.kind === 'clip' ? <ClipBeat beat={b} /> : <StillBeat beat={b} />}
          </TransitionSeries.Sequence>,
          ...(i < beats.length - 1
            ? [<TransitionSeries.Transition key={`${b.id}-t`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />]
            : []),
        ])}
      </TransitionSeries>
      <Progress />
      <Soundtrack starts={starts} />
    </AbsoluteFill>
  )
}
