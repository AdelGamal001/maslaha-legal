// Dev-only check for the landing pages (index.html + en.html). No dependencies of its own: puppeteer-core is found in the
// game tree's node_modules (or a local one), Chrome from the usual Windows path (or CHROME_PATH).
//   node scripts/check-site5.mjs                     run every assertion
//   node scripts/check-site5.mjs --shots=<folder>    also write screenshots (1440x900 and 390x844, both pages)
//   node scripts/check-site5.mjs --static            static assertions only (no browser)
// Static part needs no browser; the live part serves the repo root on 127.0.0.1 and fails on any non-local request.
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseLegalMd, LEGAL_MD, UPDATED } from './gen-legal.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GAME = process.env.SITE5_GAME_TREE || 'G:/Work Space/maslahtak2/worktrees/maslahtak-merge-meta'
const shotsArg = process.argv.find((a) => a.startsWith('--shots='))
const shotsDir = shotsArg ? resolve(shotsArg.slice(8)) : null
const dprArg = process.argv.find((a) => a.startsWith('--dpr='))
const DPR = dprArg ? +dprArg.slice(6) : 1
const PAGES = ['index.html', 'en.html']
let failed = 0
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failed++; console.log('  FAIL ' + msg) } }
const warn = (msg) => console.log('  note ' + msg)
const read = (f) => readFileSync(join(root, f), 'utf8')

// ---------- static checks ----------
console.log('static')
const html = Object.fromEntries(PAGES.map((p) => [p, read(p)]))
for (const p of PAGES) {
  const t = html[p]
  ok(!/mailto:/i.test(t), `${p}: no mailto: link`)
  ok(!/hello@/i.test(t), `${p}: no email address`)
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(t), `${p}: no inline script`)
  ok(!/https?:\/\/(?!(www\.instagram\.com|maslahagame\.com)\b)/i.test(t.replace(/<a [^>]*href="https?:[^>]*>/g, '')), `${p}: only same-origin resources (external URLs are plain links to Instagram)`)
  ok(/<html lang="(ar|en)" dir="(rtl|ltr)">/.test(t), `${p}: lang and dir set`)
}
ok(/<html lang="ar" dir="rtl">/.test(html['index.html']), 'index.html is lang="ar" rtl')
ok(/<html lang="en" dir="ltr">/.test(html['en.html']), 'en.html is lang="en" ltr')
ok(statSync(join(root, 'home.js')).size <= 6144, `home.js is ${statSync(join(root, 'home.js')).size} bytes (budget 6144)`)
ok(!/\b(import|require|fetch|XMLHttpRequest|https?:\/\/)/.test(read('home.js')), 'home.js: no imports, no network')
ok(!/@import|https?:\/\/(?!www\.w3\.org)/.test(read('home.css').replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, '')), 'home.css: no @import, no remote url()')
for (const f of ['img/adel.webp', 'img/duo.webp', 'img/est/KS.webp', 'img/shop.webp']) ok(!existsSync(join(root, f)), `${f} is gone`)
ok(!/adel\.webp|duo\.webp|KS\.webp|shop\.webp/.test(html['index.html'] + html['en.html'] + read('home.css')), 'no reference to the removed images')
const imgs = ['img', 'img/est'].flatMap((d) => readdirSync(join(root, d)).filter((f) => f.endsWith('.webp')).map((f) => d + '/' + f))
const orphans = imgs.filter((f) => !(html['index.html'] + html['en.html'] + read('home.css')).includes(f) && !f.startsWith('img/est/') || (f.startsWith('img/est/') && !html['index.html'].includes(f.slice(8, -5)) ))
ok(orphans.length === 0, `every image in img/ is used${orphans.length ? ': ' + orphans.join(', ') : ''}`)
// SITE5 rule that still holds: nothing here may touch the domain file, the two redirect stubs or the shared legal stylesheet.
// (The four legal page pairs are rewritten on purpose by the 0.2.4 policy publish and are pinned below instead of frozen.)
try {
  const names = execFileSync('git', ['diff', '--name-only', 'main'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  const frozen = names.filter((n) => n === 'styles.css' || n === 'CNAME' || n === 'ar.html' || n === 'index-en.html')
  ok(frozen.length === 0, `git diff main touches no CNAME, redirect stub or styles.css${frozen.length ? ': ' + frozen.join(', ') : ''}`)
} catch { warn('git diff main not available') }

// ---------- legal pages: the published policy and terms ----------
console.log('legal pages')
const LEGAL = ['privacy.html', 'privacy-en.html', 'terms.html', 'terms-en.html', 'support.html', 'support-en.html', 'account-deletion.html', 'account-deletion-en.html']
const legalHtml = Object.fromEntries(LEGAL.map((p) => [p, read(p)]))
const norm = (t) => t.replace(/\s+/g, ' ').trim()
const plain = (h) => norm(h.replace(/<\/(p|h2|section|h1)>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
const sectionsOf = (t) => [...t.matchAll(/<section(?: id="([^"]*)")?>([\s\S]*?)<\/section>/g)].map(([, id, body]) => ({ id: id || '', h: plain((/<h2>([\s\S]*?)<\/h2>/.exec(body) || ['', ''])[1]), p: plain(body.replace(/<h2>[\s\S]*?<\/h2>/, '')) }))
if (!existsSync(LEGAL_MD)) warn('legal-site.md not found at ' + LEGAL_MD + ' (set SITE5_GAME_TREE): the text pin is skipped')
else {
  const md = parseLegalMd(readFileSync(LEGAL_MD, 'utf8'))
  for (const [kind, file] of [['privacy', 'privacy.html'], ['terms', 'terms.html']]) {
    const page = sectionsOf(legalHtml[file])
    // the one allowed addition is the «الموقع» section, unless legal-site.md already carries it
    const siteOnly = page.filter((x) => x.id === 'site' && !md[kind].some((m) => m.h === x.h))
    const body = page.filter((x) => !siteOnly.includes(x))
    const same = body.length === md[kind].length && body.every((x, i) => x.h === norm(md[kind][i].h) && x.p === norm(md[kind][i].p))
    ok(same, `${file}: ${body.length} sections equal legal-site.md word for word (headings and text, whitespace normalised)`)
    if (!same) { const i = body.findIndex((x, k) => !md[kind][k] || x.h !== norm(md[kind][k].h) || x.p !== norm(md[kind][k].p)); console.log('    first difference at section ' + (i + 1) + ': ' + (body[i] || {}).h) }
  }
}
ok(sectionsOf(legalHtml['privacy.html']).some((x) => x.id === 'site' && x.h === 'الموقع') && sectionsOf(legalHtml['privacy-en.html']).some((x) => x.id === 'site' && x.h === 'This website'), 'both privacy pages carry the «الموقع» / «This website» section (website analytics)')
const secs = Object.fromEntries(LEGAL.map((f) => [f, sectionsOf(legalHtml[f])]))
for (const [a, e] of [['privacy.html', 'privacy-en.html'], ['terms.html', 'terms-en.html'], ['support.html', 'support-en.html'], ['account-deletion.html', 'account-deletion-en.html']]) {
  ok(secs[a].length === secs[e].length && secs[a].every((x, i) => x.id === secs[e][i].id), `${a} / ${e}: same number of sections and same anchors (${secs[a].length})`)
}
for (const f of LEGAL) {
  const t = legalHtml[f]
  ok(!/<script/i.test(t), `${f}: no script`)
  ok(!/https?:\/\/(?!(www\.instagram\.com|cloud-prod\.colyseus\.io|posthog\.com|www\.revenuecat\.com)\b)/i.test(t.replace(/<a [^>]*href="https?:[^>]*>/g, '')), `${f}: no external resource, only plain links`)
  ok(t.includes('hello@maslahagame.com'), `${f}: official email present`)
  ok(t.includes(`datetime="${UPDATED.iso}"`) && t.includes(UPDATED[/-en\.html$/.test(f) ? 'en' : 'ar']), `${f}: updated ${UPDATED.iso}`)
}
ok(legalHtml['privacy.html'].includes('عادل جمال محمد عبد الله') && legalHtml['terms.html'].includes('عادل جمال محمد عبد الله'), 'privacy.html and terms.html name the data controller «عادل جمال محمد عبد الله»')
ok(legalHtml['privacy-en.html'].includes('Adel Gamal Mohamed Abdullah') && legalHtml['terms-en.html'].includes('Adel Gamal Mohamed Abdullah'), 'the English pages name him too')
ok(/<section id="delete">/.test(legalHtml['privacy.html']) && /<section id="delete">/.test(legalHtml['privacy-en.html']), 'privacy pages carry the #delete anchor (store answers link to privacy.html#delete)')
ok(/امسح بياناتي/.test(legalHtml['account-deletion.html']) && /Delete my data/.test(legalHtml['account-deletion-en.html']) && /رقم جهازك/.test(legalHtml['account-deletion.html']) && /device number/i.test(legalHtml['account-deletion-en.html']), 'deletion pages: «امسح بياناتي» in Settings and the device number in the request')
ok(!/مش بينفّذ حذف|does not currently delete/.test(legalHtml['account-deletion.html'] + legalHtml['account-deletion-en.html']), 'deletion pages no longer say the delete button does nothing')
ok(/30 يوم/.test(legalHtml['account-deletion.html']) && /90 يوم/.test(legalHtml['account-deletion.html']) && /30 days/.test(legalHtml['account-deletion-en.html']) && /90 days/.test(legalHtml['account-deletion-en.html']), 'deletion pages state the 30-day crash logs and 90-day reports')
{ // every internal href on the legal pages resolves, anchors included
  let bad = 0
  for (const f of LEGAL) for (const [, h] of legalHtml[f].matchAll(/\bhref="([^"]+)"/g)) {
    if (/^(https:|mailto:)/.test(h)) continue
    const [file, anchor] = h.split('#'); const target = file || f
    if (!existsSync(join(root, target))) { bad++; console.log('    ' + f + ': missing file ' + h); continue }
    if (anchor && !new RegExp('\\sid="' + anchor + '"').test(read(target))) { bad++; console.log('    ' + f + ': missing anchor ' + h) }
  }
  ok(bad === 0, 'legal pages: every internal link and anchor resolves')
}

// the two pages must have the same skeleton (tags + classes), only the words differ
const skeleton = (t) => [...t.matchAll(/<([a-z0-9]+)((?:\s[^>]*)?)>/gi)].map(([, tag, attrs]) => {
  const cls = /class="([^"]*)"/.exec(attrs); const id = /\sid="([^"]*)"/.exec(attrs)
  const toks = cls ? cls[1].split(' ').filter((k) => k !== 'ar') : []
  return tag + (id ? '#' + id[1] : '') + (toks.length ? '.' + toks.join('.') : '')
}).join(' ')
ok(skeleton(html['index.html']) === skeleton(html['en.html']), 'index.html and en.html share one structure')

// copy facts
const board = (t) => [...(/<div class="track">([\s\S]*?)<\/div><\/div>/.exec(t) || ['', ''])[1].matchAll(/<span>(.*?)<\/span>/g)].map((m) => m[1])
for (const p of PAGES) {
  const items = board(html[p]); const half = items.length / 2
  ok(half === 10 && items.slice(0, half).join('|') === items.slice(half).join('|'), `${p}: ticker has 10 hint lines, repeated once for the loop`)
  ok(items.slice(0, half).every((x) => x.split(/\s+/).length <= 7), `${p}: every ticker line is 7 words or fewer`)
}
const statsOf = (t) => [...t.matchAll(/data-to="(\d+)"/g)].map((m) => +m[1])
ok(statsOf(html['index.html']).join() === statsOf(html['en.html']).join(), 'both pages show the same four numbers: ' + statsOf(html['index.html']).join(' / '))
try {
  const mod = await import(pathToFileURL(join(GAME, 'src/game/clerkManifest.js')).href)
  const [games, clerks, chars, players] = statsOf(html['index.html'])
  ok(games === mod.COUNTS.games, `minigames ${games} = clerkManifest games ${mod.COUNTS.games}`)
  ok(clerks === mod.COUNTS.clerks, `clerks ${clerks} = clerkManifest clerks ${mod.COUNTS.clerks}`)
  ok(players === 11, 'max players 11 (tuning room size)')
  const stats = readFileSync(join(GAME, 'src/game/stats.js'), 'utf8'); const tun = readFileSync(join(GAME, 'src/game/tuning.js'), 'utf8')
  const ids = [...stats.matchAll(/^\s*\{ id: 'c(\d+)'/gm)].map((m) => +m[1])
  const list = (re) => [...(re.exec(tun) || ['', ''])[1].matchAll(/'c(\d+)'/g)].map((m) => +m[1])
  const hidden = new Set([...list(/hidden: \[([^\]]*)\]/), ...list(/future: \[([^\]]*)\]/)])
  const visible = ids.filter((n) => !hidden.has(n)).length
  const c63 = ids.includes(63)
  ok(chars === visible + (c63 ? 0 : 1), `characters ${chars} = visible roster ${visible}${c63 ? '' : ' + c63 (CHAR63 not merged in this tree yet)'}`)
} catch (e) { warn('game-tree facts not checked: ' + e.message) }

// ---------- live checks ----------
if (process.argv.includes('--static')) { console.log(failed ? `\n${failed} static check(s) FAILED` : '\nstatic checks passed'); process.exit(failed ? 1 : 0) }
const req = createRequire(join(GAME, 'package.json'))
let puppeteer
for (const spec of [join(root, 'node_modules/puppeteer-core'), 'puppeteer-core']) { try { puppeteer = createRequire(import.meta.url)(spec); break } catch { /* next */ } }
if (!puppeteer) { try { puppeteer = req('puppeteer-core') } catch { /* none */ } }
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => p && existsSync(p))
if (!puppeteer || !CHROME) { warn('puppeteer-core or Chrome not found: live checks skipped'); process.exit(failed ? 1 : 0) }

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' }
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
if (shotsDir) mkdirSync(shotsDir, { recursive: true })

async function open(page, url, w, h, reduce) {
  const bad = []; const errors = []; const notFound = []
  await page.setViewport({ width: w, height: h, deviceScaleFactor: w < 721 ? DPR : 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }])
  page.removeAllListeners('request'); page.removeAllListeners('response'); page.removeAllListeners('console'); page.removeAllListeners('pageerror')
  page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) bad.push(r.url()) })
  page.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 400) notFound.push(r.status() + ' ' + r.url()) })
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.evaluateOnNewDocument(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
  await page.goto(base + url, { waitUntil: 'networkidle0' })
  return { bad, errors, notFound }
}
async function scrollAll(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < h; y += 320) { await page.evaluate((yy) => scrollTo(0, yy), y); await sleep(70) }
  await sleep(500)
}

for (const p of PAGES) {
  for (const [w, h, label] of [[1440, 900, 'desktop 1440x900'], [390, 844, 'phone 390x844']]) {
    console.log(`live ${p} ${label}`)
    const page = await browser.newPage()
    const log = await open(page, '/' + p, w, h, false)
    await sleep(1500)
    if (shotsDir) await page.screenshot({ path: join(shotsDir, `${p.replace('.html', '')}-hero-${w}x${h}.png`) })
    await scrollAll(page)
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, iw: innerWidth, bw: document.body.scrollWidth, cls: window.__cls,
      papers: [...document.querySelectorAll('.papers i')].filter((e) => getComputedStyle(e).display !== 'none').length,
      fan: [...document.querySelectorAll('.pc')].map((e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), z: +getComputedStyle(e).zIndex } }),
      fanSection: (() => { const r = document.querySelector('.est').getBoundingClientRect(); return { l: r.left, r: r.right } })(),
      flows: [...document.querySelectorAll('.stepx')].map((s) => +getComputedStyle(s).getPropertyValue('--fill')),
      stepsIn: document.querySelectorAll('.stepx.in').length,
      revealsLeft: document.querySelectorAll('.reveal:not(.in)').length,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      ladder: [...document.querySelectorAll('.rung img')].length,
    }))
    ok(m.sw <= m.iw && m.bw <= m.iw, `no horizontal overflow (scrollWidth ${m.sw} <= ${m.iw})`)
    ok(log.bad.length === 0, 'zero external requests' + (log.bad.length ? ': ' + log.bad.join(', ') : ''))
    ok(log.notFound.length === 0, 'every local request resolves' + (log.notFound.length ? ': ' + log.notFound.join(', ') : ''))
    ok(log.errors.length === 0, 'no console or page errors' + (log.errors.length ? ': ' + log.errors.join(' | ') : ''))
    ok(m.broken.length === 0, 'no broken image' + (m.broken.length ? ': ' + m.broken.join(', ') : ''))
    ok(m.cls < 0.05, `layout shift ${m.cls.toFixed(4)} < 0.05`)
    ok(m.papers === (w < 721 ? 5 : 8), `${m.papers} falling sheets (${w < 721 ? 'phone: 5' : 'desktop: 8'})`)
    ok(m.stepsIn === 6 && m.revealsLeft === 0, 'six steps and every reveal ran once')
    ok(m.flows.every((f) => f > 0.99), 'ink line filled after scrolling through (' + m.flows.join(' ') + ')')
    const fl = m.fan
    ok(fl.length === 5 && fl.every((c) => c.l >= m.fanSection.l && c.r <= m.fanSection.r), 'five fan cards inside the section (no clipping)')
    ok(fl[2].z > fl[1].z && fl[1].z > fl[0].z && fl[2].z > fl[3].z && fl[3].z > fl[4].z && fl[1].z === fl[3].z && fl[0].z === fl[4].z, 'fan stacking: centre on top, descending outward, symmetric')
    ok(Math.abs((fl[0].l + fl[4].r) / 2 - (fl[2].l + fl[2].r) / 2) < 3, 'fan is symmetric around the centre card')
    if (shotsDir) {
      await page.evaluate(() => scrollTo(0, 0)); await sleep(300)
      await page.screenshot({ path: join(shotsDir, `${p.replace('.html', '')}-full-${w}x${h}.png`), fullPage: true })
      for (const id of ['how', 'estimation', 'ways', 'clerks', 'custom', 'maker', 'play']) {
        await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), id); await sleep(1200)
        await page.screenshot({ path: join(shotsDir, `${p.replace('.html', '')}-${id}-${w}x${h}.png`) })
      }
    }
    await page.close()
  }
  // reduced motion: nothing may be running, on load or after scrolling the whole page
  console.log(`live ${p} prefers-reduced-motion`)
  const page = await browser.newPage()
  const log = await open(page, '/' + p, 390, 844, true)
  await sleep(1200); await scrollAll(page)
  const rm = await page.evaluate(() => ({ anims: document.getAnimations().map((a) => (a.animationName || a.transitionProperty || a.constructor.name)), vis: [...document.querySelectorAll('.reveal')].filter((e) => getComputedStyle(e).opacity !== '1').length, stamp: getComputedStyle(document.querySelector('.stampmark')).opacity, sw: document.documentElement.scrollWidth, iw: innerWidth }))
  ok(rm.anims.length === 0, 'no running animation or transition' + (rm.anims.length ? ': ' + [...new Set(rm.anims)].join(', ') : ''))
  ok(rm.vis === 0 && +rm.stamp > 0.9, 'content visible without animation (reveals + stamp)')
  ok(rm.sw <= rm.iw && log.errors.length === 0 && log.bad.length === 0, 'reduced-motion page: no overflow, no errors, no external request')
  await page.close()
}

// every internal link and anchor resolves
console.log('links')
for (const p of PAGES) {
  const hrefs = [...html[p].matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1])
  const ids = new Set([...html[p].matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
  let bad = 0
  for (const h of hrefs) {
    if (/^(https?:|data:)/.test(h)) { if (!/^https:\/\/(www\.instagram\.com\/(maslaha_game|_othman_007_|adelgamal001)|maslahagame\.com\/)/.test(h)) { bad++; console.log('    unexpected external link ' + h) } continue }
    if (h.startsWith('#')) { if (!ids.has(h.slice(1))) { bad++; console.log('    missing anchor ' + h) } continue }
    const res = await fetch(base + '/' + h).catch(() => null)
    if (!res || res.status >= 400) { bad++; console.log('    404 ' + h) }
  }
  ok(bad === 0, `${p}: ${hrefs.length} href/src values resolve`)
}
await browser.close(); server.close()
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall site5 checks passed')
process.exit(failed ? 1 : 0)
