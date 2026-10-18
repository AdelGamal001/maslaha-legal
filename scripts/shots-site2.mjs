// Dev-only: full-page JPEG screenshots of the pages Adel reviews, at phone (390) and desktop (1280) width, into review/site-2/<page>-<width>.jpg.
//   node scripts/shots-site2.mjs [outDir] [page.html …]   (default: review/site-2 and all six pages; name pages to re-shoot only those; every file stays under 600 KB: the JPEG quality goes down from 80, then the size, until it does)
// Same setup as check-site5.mjs: puppeteer-core from the game tree's node_modules (SITE5_GAME_TREE) or a local one, Chrome from CHROME_PATH or the usual places.
// The repo root is served on 127.0.0.1 and every request to another host is aborted, so nothing leaves the machine (the live numbers show their offline state).
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GAME = process.env.SITE5_GAME_TREE || 'G:/Work Space/maslahtak2/worktrees/maslahtak-merge-meta'
const out = resolve(process.argv[2] || join(root, 'review/site-2'))
const ALL_PAGES = ['index.html', 'en.html', 'privacy.html', 'privacy-en.html', 'account-deletion.html', 'account-deletion-en.html']
const PAGES = process.argv.length > 3 ? process.argv.slice(3) : ALL_PAGES
for (const p of PAGES) if (!ALL_PAGES.includes(p)) throw new Error('unknown page ' + p + ' (one of ' + ALL_PAGES.join(', ') + ')')
const WIDTHS = [390, 1280]
// [scale, JPEG quality], tried in this order until a file is under MAX_BYTES. Short pages stay at 1 / 80. A tall illustrated page first loses quality (phone width: down to 45 at full size;
// desktop: down to 55, then it is saved at 80% width = 1024 px, then smaller). The names and the 390 / 1280 layouts never change; only the saved image gets smaller.
const STEPS = { 390: [[1, 80], [1, 70], [1, 60], [1, 55], [1, 50], [1, 45], [0.9, 50], [0.8, 55], [0.7, 55], [0.6, 55]], 1280: [[1, 80], [1, 70], [1, 60], [1, 55], [0.8, 70], [0.8, 60], [0.8, 55], [0.8, 50], [0.7, 60], [0.7, 50], [0.6, 60]] }
const MAX_BYTES = 600_000 // 600 KB, counted the strict way (decimal)

let puppeteer
for (const spec of [join(root, 'node_modules/puppeteer-core'), 'puppeteer-core']) { try { puppeteer = createRequire(import.meta.url)(spec); break } catch { /* next */ } }
if (!puppeteer) { try { puppeteer = createRequire(join(GAME, 'package.json'))('puppeteer-core') } catch { /* none */ } }
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => p && existsSync(p))
if (!puppeteer || !CHROME) throw new Error('puppeteer-core or Chrome not found (set SITE5_GAME_TREE and CHROME_PATH)')

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }
const server = createServer((rq, rs) => {
  let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname); if (p === '/') p = '/index.html'
  const f = join(root, p)
  if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { rs.writeHead(404); rs.end('nope'); return }
  rs.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); rs.end(readFileSync(f))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = 'http://127.0.0.1:' + server.address().port
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(out, { recursive: true })

for (const p of PAGES) {
  for (const w of WIDTHS) {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: w < 721 ? 844 : 900, deviceScaleFactor: 1 })
    await page.setRequestInterception(true)
    page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort()))
    await page.goto(`${base}/${p}`, { waitUntil: 'networkidle0' })
    // scroll the whole page once (instant, two painted frames per step) so every reveal and the ink line have run, then come back to the top
    const height = () => page.evaluate(() => document.documentElement.scrollHeight)
    const to = (y) => page.evaluate((yy) => { scrollTo({ top: yy, behavior: 'instant' }); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) }, y)
    for (let y = 0; y < await height(); y += 240) { await to(y); await sleep(30) }
    await to(await height()); await sleep(700); await to(0); await sleep(1500)
    const file = join(out, `${p.replace('.html', '')}-${w}.jpg`)
    let used = STEPS[w][0]
    for (const step of STEPS[w]) {
      used = step
      await page.setViewport({ width: w, height: w < 721 ? 844 : 900, deviceScaleFactor: step[0] })
      await page.screenshot({ path: file, type: 'jpeg', quality: step[1], fullPage: true })
      if (statSync(file).size <= MAX_BYTES) break
    }
    console.log(`${file.slice(root.length + 1)}  ${(statSync(file).size / 1024).toFixed(0)} KB  (quality ${used[1]}, scale ${used[0]})`)
    await page.close()
  }
}
await browser.close(); server.close()
