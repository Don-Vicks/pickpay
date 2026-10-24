// Builds docs/PickPay-submission.pdf for judges: a cover page, then the problem/impact statement,
// architecture (diagrams rendered) and security assessment. Markdown is rendered by GitHub's API
// (gh api markdown) so it matches the repo, and Chrome prints it.
//   node scripts/build-pdf.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const ROOT = new URL('..', import.meta.url).pathname
// puppeteer-core is installed with the video tooling (video/package.json).
const puppeteer = createRequire(join(ROOT, 'video/package.json'))('puppeteer-core')
const DOCS = ['docs/impact.md', 'docs/architecture.md', 'docs/security.md']

const render = (file) =>
  execFileSync('gh', ['api', 'markdown', '-f', 'mode=gfm', '-f', 'context=Don-Vicks/pickpay', '-F', `text=@${join(ROOT, file)}`], {
    encoding: 'utf8',
  })
    // GitHub wraps mermaid blocks in an iframe loader; keep only the raw diagram for mermaid.js.
    .replace(/<section class="js-render-needs-enrichment[\s\S]*?<pre lang="mermaid"[^>]*>([\s\S]*?)<\/pre>[\s\S]*?<\/section>/g, '<pre class="mermaid">$1</pre>')

const cover = `
<section class="cover">
  <p class="eyebrow">IEEE ClimateChain Global Hackathon · Track 3: Sustainable Supply Chains</p>
  <h1>PickPay</h1>
  <p class="tagline">Every kilo of plastic paid once, claimed once.</p>
  <p>Waste pickers in Lagos are paid within seconds for plastic that AI grades from a photo. Recycling credits exist only after a recycler confirms the plastic, and each kilo can be claimed by exactly one brand, enforced by a Solana program.</p>
  <table>
    <tr><td>Code</td><td>https://github.com/Don-Vicks/pickpay</td></tr>
    <tr><td>Demo video</td><td>https://youtu.be/wqHe-604t4c</td></tr>
    <tr><td>Program (devnet)</td><td>47EHi4xhP3o6T7TUsMVRNMse4Xdcs1zRHLXxSpncgLTz</td></tr>
    <tr><td>Author</td><td>Victor Shallangwa</td></tr>
  </table>
  <p class="contents">Contents: 1. Problem, climate impact and roadmap · 2. Architecture and technical spec · 3. Security and data-integrity assessment</p>
</section>`

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown-light.css">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { margin: 0; }
  .markdown-body { font-size: 11.5pt; }
  .doc { page-break-before: always; }
  .cover { padding-top: 60mm; }
  .cover h1 { font-size: 44pt; border: 0; margin: 4mm 0; color: #047857; }
  .cover .eyebrow { color: #047857; font-weight: 600; }
  .cover .tagline { font-size: 18pt; font-weight: 600; }
  .cover table td:first-child { font-weight: 600; white-space: nowrap; }
  .cover .contents { margin-top: 14mm; color: #555; }
  pre.mermaid { background: none; text-align: center; }
  table { font-size: 10pt; }
</style></head>
<body><article class="markdown-body">
${cover}
${DOCS.map((d) => `<section class="doc">${render(d)}</section>`).join('\n')}
</article>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: false, theme: 'neutral' }); mermaid.run().catch((e) => (window.__err = String(e))).finally(() => (window.__done = true))</script>
</body></html>`

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__done === true, { timeout: 30000 })
const err = await page.evaluate(() => window.__err ?? null)
// A diagram mermaid can't parse still renders, as a "Syntax error" bomb, so check for that too.
const broken = await page.evaluate(() => [...document.querySelectorAll('pre.mermaid svg')].filter((s) => s.textContent.includes('Syntax error')).length)
if (err || broken) {
  console.error('diagram error:', err ?? `${broken} diagram(s) failed to parse`)
  process.exit(1)
}
console.log('diagrams rendered:', await page.evaluate(() => document.querySelectorAll('pre.mermaid svg').length))
const out = join(ROOT, 'docs/PickPay-submission.pdf')
await page.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:8pt;color:#888;width:100%;text-align:center">PickPay · IEEE ClimateChain Global Hackathon · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' } })
await browser.close()
console.log(`wrote ${out} (${(readFileSync(out).length / 1024).toFixed(0)} KB)`)
