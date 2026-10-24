import { loadFont } from '@remotion/google-fonts/Geist'
import { fade } from '@remotion/transitions/fade'
import { linearTiming, TransitionSeries } from '@remotion/transitions'
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { beatsFor, TRANSITION, type Beat, type Pan, type Zoom } from './beats'

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

function StepPill({ step }: { step: string }) {
  const p = useEnter(2)
  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: 60,
        padding: '10px 22px',
        borderRadius: 999,
        background: 'rgba(16,185,129,0.14)',
        border: '1px solid rgba(16,185,129,0.45)',
        color: C.accent,
        fontSize: 28,
        fontWeight: 600,
        opacity: p,
      }}
    >
      {step}
    </div>
  )
}

function Caption({ text }: { text: string }) {
  const p = useEnter(8)
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        opacity: p,
        transform: `translateY(${(1 - p) * 24}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          textAlign: 'center',
          color: C.text,
          fontSize: 46,
          fontWeight: 600,
          lineHeight: 1.2,
          padding: '18px 34px',
          borderRadius: 22,
          background: 'rgba(10,10,10,0.82)',
          border: `1px solid ${C.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {text}
      </div>
    </div>
  )
}

/** A screenshot inside a frame, with an optional slow zoom toward a point and a vertical pan. */
function Shot({ src, width, height, zoom, pan, radius }: { src: string; width: number; height: number; zoom?: Zoom; pan?: Pan; radius: number }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = interpolate(frame, [10, durationInFrames - 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) })
  const scale = zoom ? interpolate(t, [0, 1], [zoom.from, zoom.to]) : 1
  const panY = pan ? interpolate(t, [0, 1], [pan.from, pan.to]) : 0
  return (
    <div style={{ width, height, overflow: 'hidden', borderRadius: radius, position: 'relative', background: C.bg }}>
      <Img
        src={staticFile(`shots/${src}`)}
        style={{
          position: 'absolute',
          left: 0,
          width: '100%',
          // Tall screenshots pan from top (0) to bottom (1); short ones just sit at the top.
          top: pan ? `${-panY * 100}%` : 0,
          transform: pan ? `translateY(${panY * height}px) scale(${scale})` : `scale(${scale})`,
          transformOrigin: zoom ? `${zoom.x * 100}% ${zoom.y * 100}%` : 'center top',
        }}
      />
    </div>
  )
}

function BrowserBeat({ beat }: { beat: Exclude<Beat, { kind: 'text' }> }) {
  const p = useEnter()
  const w = 1400
  const h = 760
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 110 }}>
      <div
        style={{
          width: w,
          borderRadius: 22,
          border: `1px solid ${C.border}`,
          background: C.panel,
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
          opacity: p,
          transform: `translateY(${(1 - p) * 40}px) scale(${0.97 + p * 0.03})`,
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', borderBottom: `1px solid ${C.border}` }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, opacity: 0.85 }} />
          ))}
          <span style={{ marginLeft: 18, color: C.muted, fontSize: 22 }}>{beat.url}</span>
        </div>
        <Shot src={beat.shot} width={w} height={h - 52} zoom={beat.zoom} pan={beat.pan} radius={0} />
      </div>
      {beat.step && <StepPill step={beat.step} />}
      <Caption text={beat.caption} />
    </AbsoluteFill>
  )
}

function PhoneBeat({ beat }: { beat: Exclude<Beat, { kind: 'text' }> }) {
  const p = useEnter()
  const h = 790
  const w = Math.round((h * 390) / 844)
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 50 }}>
      <div
        style={{
          padding: 14,
          borderRadius: 64,
          background: '#1c1c1c',
          border: '2px solid rgba(255,255,255,0.14)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.65)',
          opacity: p,
          transform: `translateY(${(1 - p) * 40}px)`,
        }}
      >
        <Shot src={beat.shot} width={w} height={h} zoom={beat.zoom} radius={50} />
      </div>
      {beat.step && <StepPill step={beat.step} />}
      <Caption text={beat.caption} />
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

export function Demo({ cut }: { cut: 'full' | 'short' }) {
  const beats = beatsFor(cut)
  return (
    <AbsoluteFill style={{ fontFamily, color: C.text }}>
      <Backdrop />
      <TransitionSeries>
        {beats.flatMap((b, i) => [
          <TransitionSeries.Sequence key={b.id} durationInFrames={b.frames} premountFor={30}>
            {b.kind === 'text' ? <TextBeat beat={b} /> : b.kind === 'phone' ? <PhoneBeat beat={b} /> : <BrowserBeat beat={b} />}
          </TransitionSeries.Sequence>,
          ...(i < beats.length - 1
            ? [<TransitionSeries.Transition key={`${b.id}-t`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />]
            : []),
        ])}
      </TransitionSeries>
      <Progress />
    </AbsoluteFill>
  )
}
