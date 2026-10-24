// Full-resolution screen recording of a puppeteer page. Chrome's screencast sends a JPEG whenever
// the page repaints; we keep each frame with its timestamp and let ffmpeg turn the variable-rate
// sequence into a constant 30 fps MP4. (page.screencast() records at CSS-pixel size only.)
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export async function startRecording(page, { width = 1920, height = 912 } = {}) {
  const session = await page.createCDPSession()
  const frames = []
  const t0 = Date.now() / 1000
  session.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp ?? Date.now() / 1000 })
    try {
      await session.send('Page.screencastFrameAck', { sessionId })
    } catch {}
  })
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width, maxHeight: height, everyNthFrame: 1 })

  /** Seconds since recording started, for timing highlights. */
  const now = () => Date.now() / 1000 - t0

  async function stop(outPath) {
    // Hold the last frame a moment so the clip doesn't end on a cut.
    await new Promise((r) => setTimeout(r, 400))
    await session.send('Page.stopScreencast')
    await session.detach()
    if (frames.length === 0) throw new Error('no frames recorded')
    const dir = `${outPath}.frames`
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const start = frames[0].t
    let list = ''
    frames.forEach((f, i) => {
      const name = `f${String(i).padStart(5, '0')}.jpg`
      writeFileSync(join(dir, name), Buffer.from(f.data, 'base64'))
      const next = frames[i + 1]?.t ?? Date.now() / 1000
      list += `file '${name}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`
    })
    list += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`
    writeFileSync(join(dir, 'list.txt'), list)
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
      '-vf', `fps=30,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0a,format=yuv420p`,
      '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', outPath,
    ])
    rmSync(dir, { recursive: true, force: true })
    return { frames: frames.length, offset: start - t0 }
  }

  return { now, stop }
}

/** A visible cursor and click ripple, since headless Chrome draws no pointer. */
export const CURSOR_SCRIPT = `
(() => {
  if (window.__cursor) return
  const c = document.createElement('div')
  c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;z-index:2147483647;pointer-events:none;transition:transform .05s'
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.5 L10 13 L16 13 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  document.documentElement.appendChild(c)
  window.__cursor = c
  addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
  addEventListener('mousedown', (e) => {
    const r = document.createElement('div')
    r.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #34d399;z-index:2147483646;pointer-events:none;left:' + e.clientX + 'px;top:' + e.clientY + 'px;transition:transform .45s ease-out,opacity .45s ease-out;transform:scale(.3);opacity:1'
    document.documentElement.appendChild(r)
    requestAnimationFrame(() => { r.style.transform = 'scale(1.4)'; r.style.opacity = '0' })
    setTimeout(() => r.remove(), 600)
  }, true)
})()
`
