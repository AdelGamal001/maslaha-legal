// Dev-only: full-page JPEG screenshots of the pages Adel reviews, at phone (390) and desktop (1280) width, into review/site-2/<page>-<width>.jpg.
//   node scripts/shots-site2.mjs [outDir]          (default: review/site-2)
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
const PAGES = ['index.html', 'en.html', 'privacy.html', 'privacy-en.html', 'account-deletion.html', 'account-deletion-en.html']
const WIDTHS = [390, 1280]
const QUALITY = 80

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
    await page.screenshot({ path: file, type: 'jpeg', quality: QUALITY, fullPage: true })
    console.log(`${file.slice(root.length + 1)}  ${(statSync(file).size / 1024).toFixed(0)} KB`)
    await page.close()
  }
}
await browser.close(); server.close()
