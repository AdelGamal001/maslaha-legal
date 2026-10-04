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
// The only outside hosts the landing pages may talk to: PostHog EU (analytics.js: the library + the capture endpoint) and the game server (stats.js: GET /stats).
const POSTHOG_HOSTS = ['eu-assets.i.posthog.com', 'eu.i.posthog.com']
const GAME_HOST = 'de-fra-2bb59b4f.colyseus.cloud'
const LIVE_URL = `https://${GAME_HOST}/stats`
const PH_KEY = 'phc_r4f8hDgcyBiZfSfhaWYjeYGigNkT4E7tvFauUAscDbrU'
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
  ok(!/https?:\/\/(?!(www\.instagram\.com|maslahagame\.com)\b)/i.test(t.replace(/<a [^>]*href="https?:[^>]*>/g, '').replace(` data-live="${LIVE_URL}"`, '')), `${p}: only same-origin resources (external URLs are plain links to Instagram; the one other host is the game server's /stats in data-live)`)
  ok(/<html lang="(ar|en)" dir="(rtl|ltr)">/.test(t), `${p}: lang and dir set`)
}
ok(/<html lang="ar" dir="rtl">/.test(html['index.html']), 'index.html is lang="ar" rtl')
ok(/<html lang="en" dir="ltr">/.test(html['en.html']), 'en.html is lang="en" ltr')
ok(statSync(join(root, 'home.js')).size <= 6144, `home.js is ${statSync(join(root, 'home.js')).size} bytes (budget 6144)`)
ok(!/\b(import|require|fetch|XMLHttpRequest|https?:\/\/)/.test(read('home.js')), 'home.js: no imports, no network')
ok(!/@import|https?:\/\/(?!www\.w3\.org)/.test(read('home.css').replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, '')), 'home.css: no @import, no remote url()')

// ---------- SITE-STATS: analytics snippet, the «أرقام حقيقية» box, the numbers pipeline ----------
console.log('analytics + real-numbers box')
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '') // the files' header comments describe what they avoid; the assertions look at the code
const an = code(read('analytics.js')); const st = code(read('stats.js'))
const hostsIn = (t) => [...new Set([...t.matchAll(/https?:\/\/([^/'"\s)]+)/g)].map((m) => m[1]))].sort()
ok(JSON.stringify(hostsIn(an)) === JSON.stringify([...POSTHOG_HOSTS].sort()), `analytics.js talks to exactly the two PostHog hosts: ${hostsIn(an).join(', ')}`)
ok(an.includes(`'${PH_KEY}'`) && an.includes("HOST='https://eu.i.posthog.com'") && an.includes("ASSETS='https://eu-assets.i.posthog.com/static/array.js'"), 'analytics.js: the public project key, api_host eu.i.posthog.com, the library from eu-assets.i.posthog.com')
for (const [re, what] of [[/persistence:'memory'/, "persistence 'memory' (no cookies, no localStorage)"], [/disable_session_recording:true/, 'session recording off'], [/capture_pageview:true/, 'pageview on'], [/capture_pageleave:true/, 'pageleave (scroll depth) on'],
  [/person_profiles:'never'/, "person_profiles 'never'"], [/ip:false/, 'ip not sent'], [/autocapture:\{dom_event_allowlist:\['click'\],element_allowlist:\['a','button'\]\}/, 'autocapture limited to clicks on a and button'],
  [/doNotTrack==='1'/, 'Do Not Track = nothing loads'], [/requestIdleCallback/, 'loads after first paint (requestIdleCallback)'], [/surface:'site'/, "super property surface 'site'"], [/'site_cta',\{where:a\.dataset\.cta,lang:/, 'site_cta { where, lang }']]) ok(re.test(an), `analytics.js: ${what}`)
ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(an + st), 'analytics.js and stats.js never touch cookies or storage')
ok(statSync(join(root, 'analytics.js')).size <= 4096 && statSync(join(root, 'stats.js')).size <= 4608, `analytics.js ${statSync(join(root, 'analytics.js')).size} B (budget 4096), stats.js ${statSync(join(root, 'stats.js')).size} B (budget 4608)`)
ok(hostsIn(st).length === 0, 'stats.js has no host of its own (the URLs come from data-json / data-live)')
for (const p of PAGES) {
  const t = html[p]
  ok(/<script src="stats\.js" defer><\/script>\s*<script src="analytics\.js" defer><\/script>/.test(t), `${p}: stats.js and analytics.js load deferred (never block render)`)
  const cta = [...t.matchAll(/<a [^>]*href="https:\/\/www\.instagram\.com\/maslaha_game"[^>]*>/g)].map((m) => (/data-cta="([^"]+)"/.exec(m[0]) || [])[1])
  ok(cta.length > 0 && cta.every(Boolean) && cta.every((c) => ['nav', 'hero', 'custom', 'play', 'footer'].includes(c)), `${p}: every game Instagram link has data-cta (${cta.join(', ')})`)
  ok(['nav', 'hero', 'custom', 'play', 'footer'].every((c) => cta.includes(c)), `${p}: nav, hero, custom, play and footer are all covered`)
  ok(!/data-cta/.test(t.replace(/<a [^>]*href="https:\/\/www\.instagram\.com\/maslaha_game"[^>]*>/g, '')), `${p}: data-cta only on the game's Instagram links`)
  ok(/<section id="real" class="real" data-json="stats\.json" data-live="/.test(t) && (t.match(/class="rt"/g) || []).length === 3 && t.indexOf('class="stats"') < t.indexOf('id="real"') && t.indexOf('id="real"') < t.indexOf('id="how"'), `${p}: the real-numbers box (3 tiles) sits right after the stats strip`)
}
{
  const sj = JSON.parse(read('stats.json'))
  const n = (v) => v === null || (Number.isInteger(v) && v >= 0)
  ok(Object.keys(sj).sort().join() === 'igFollowers,updatedAt,visitors30d' && n(sj.visitors30d) && n(sj.igFollowers) && (sj.updatedAt === null || !isNaN(Date.parse(sj.updatedAt))), `stats.json is { visitors30d, igFollowers, updatedAt } (${JSON.stringify(sj)})`)
}
{
  const fs = await import('./fetch-stats.mjs'); const { lintWorkflow } = await import('./lint-workflow.mjs')
  const bad = lintWorkflow(readFileSync(join(root, '.github/workflows/stats.yml'), 'utf8'), root)
  ok(bad.length === 0, 'stats.yml parses and passes the workflow sanity lint' + (bad.length ? ': ' + bad.join('; ') : ''))
  ok(fs.visitorsOf({ results: [[1234]] }) === 1234 && fs.visitorsOf({ results: [['56']] }) === 56 && fs.visitorsOf({ results: [{ c: 7 }] }) === 7 && fs.visitorsOf({ results: [] }) === null && fs.visitorsOf({ results: [[null]] }) === null && fs.visitorsOf(null) === null, 'fetch-stats: HogQL answers (rows as arrays or objects, strings, empty, null)')
  ok(fs.followersOf({ followers_count: 42 }) === 42 && fs.followersOf({ error: {} }) === null && fs.followersOf({ followers_count: -1 }) === null, 'fetch-stats: Instagram followers_count')
  ok(/properties\.\$host = 'maslahagame\.com'/.test(fs.VISITORS_QUERY) && /DISTINCT properties\.\$session_id/.test(fs.VISITORS_QUERY) && /INTERVAL 30 DAY/.test(fs.VISITORS_QUERY) && fs.PROJECT_ID === 293009 && fs.POSTHOG_API === 'https://eu.posthog.com', 'fetch-stats: HogQL counts distinct $session_id for $host maslahagame.com over 30 days, project 293009, EU cloud')
  const t0 = new Date('2026-10-05T10:00:00Z')
  ok(fs.mergeStats({ visitors30d: 5, igFollowers: 9 }, { visitors30d: 5, igFollowers: 9 }, t0) === null, 'fetch-stats: nothing changed means nothing to commit')
  ok(JSON.stringify(fs.mergeStats({ visitors30d: 5, igFollowers: 9, updatedAt: 'x' }, { visitors30d: 6, igFollowers: null }, t0)) === JSON.stringify({ visitors30d: 6, igFollowers: 9, updatedAt: t0.toISOString() }), 'fetch-stats: a failed tile keeps its old number, a changed one is written with the time')
  ok(JSON.stringify(fs.mergeStats({}, { visitors30d: null, igFollowers: null }, t0)) === 'null', 'fetch-stats: no secrets and no old file: nothing written')
  // the whole job against a fake network and a temp folder: secrets missing, secrets present, a failing API, and the token never printed
  const { mkdtempSync, writeFileSync: wf, readFileSync: rf } = await import('node:fs'); const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(join(tmpdir(), 'stats-')); wf(join(dir, 'stats.json'), JSON.stringify({ visitors30d: null, igFollowers: null, updatedAt: null }))
  const calls = []
  const net = (over = {}) => async (url, init) => {
    calls.push([String(url), init])
    if (String(url).startsWith('https://eu.posthog.com/api/projects/293009/query/')) return over.ph ? over.ph() : new Response(JSON.stringify({ results: [[321]] }), { status: 200 })
    if (String(url).includes('/me?fields=followers_count')) return over.ig ? over.ig() : new Response(JSON.stringify({ followers_count: 654 }), { status: 200 })
    if (String(url).includes('/refresh_access_token')) return over.rf ? over.rf() : new Response(JSON.stringify({ access_token: 'SECRET-TOKEN', token_type: 'bearer', expires_in: 5184000 }), { status: 200 })
    throw new Error('unexpected url ' + url)
  }
  const log = []; const realLog = console.log; console.log = (...a) => log.push(a.join(' '))
  try {
    const noSecrets = await fs.main({}, dir, net(), t0)
    const afterNone = JSON.parse(rf(join(dir, 'stats.json'), 'utf8')); const nCalls = calls.length
    const withSecrets = await fs.main({ POSTHOG_PERSONAL_API_KEY: 'phx_test', IG_TOKEN: 'SECRET-TOKEN', GITHUB_EVENT_NAME: 'workflow_dispatch' }, dir, net(), t0)
    const written = JSON.parse(rf(join(dir, 'stats.json'), 'utf8'))
    const failing = await fs.main({ POSTHOG_PERSONAL_API_KEY: 'phx_test', IG_TOKEN: 'SECRET-TOKEN' }, dir, net({ ph: () => new Response('no', { status: 500 }), ig: () => { throw new Error('offline') }, rf: () => new Response(JSON.stringify({ error: { message: 'too young' } }), { status: 400 }) }), new Date('2026-10-05T03:00:00Z'))
    const kept = JSON.parse(rf(join(dir, 'stats.json'), 'utf8'))
    console.log = realLog
    ok(noSecrets.out === null && afterNone.visitors30d === null && nCalls === 0, 'fetch-stats: without secrets it calls nothing and writes nothing')
    ok(withSecrets.out && written.visitors30d === 321 && written.igFollowers === 654 && written.updatedAt === t0.toISOString(), 'fetch-stats: with secrets it writes both numbers and the time')
    const q = calls.find(([u]) => u.startsWith('https://eu.posthog.com/api/projects/293009/query/'))
    ok(q && q[1].method === 'POST' && q[1].headers.authorization === 'Bearer phx_test' && JSON.parse(q[1].body).query.kind === 'HogQLQuery', 'fetch-stats: PostHog is asked with POST, a Bearer personal key and a HogQLQuery body')
    ok(withSecrets.refreshed && withSecrets.refreshed.days === 60 && withSecrets.refreshed.until === '2026-12-04', 'fetch-stats: the token refresh logs its new expiry (60 days)')
    ok(failing.out === null && kept.visitors30d === 321 && kept.igFollowers === 654, 'fetch-stats: failing APIs keep the old numbers and the job still ends normally')
    ok(!log.some((l) => l.includes('SECRET-TOKEN') || l.includes('phx_test')), 'fetch-stats: no secret is ever printed')
    ok(log.some((l) => l.startsWith('::warning::')), 'fetch-stats: failures surface as GitHub warnings, not as a failed job')
  } finally { console.log = realLog }
}
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

// A stand-in for PostHog's array.js: it replays the stub's init and queued calls like the real library does and records them, so the test
// can see the exact config and every capture. The real eu-assets / eu.i.posthog.com / game-server hosts are never reached: every request
// to one of the three allowed hosts is answered here, any other outside request is recorded in `bad` and aborted.
const FAKE_POSTHOG = `(function(){var s=window.posthog,rec={init:(s._i||[]).slice(),queued:[].slice.call(s),captured:[],registered:[]};window.__ph=rec;
var p={__loaded:true,capture:function(n,pr){rec.captured.push([n,pr])},register:function(pr){rec.registered.push(pr)}};
[].slice.call(s).forEach(function(c){if(p[c[0]])p[c[0]].apply(p,c.slice(1))});window.posthog=p})();`
const CORS = { 'access-control-allow-origin': '*' }
const DEFAULT_FX = { statsJson: undefined, live: { rooms: 2, players: 5, at: '2026-10-05T10:00:00.000Z' }, dnt: false }
async function open(page, url, w, h, reduce, fx = {}) {
  fx = { ...DEFAULT_FX, ...fx }
  const bad = []; const errors = []; const notFound = []; const hosts = []; const urls = []
  await page.setViewport({ width: w, height: h, deviceScaleFactor: w < 721 ? DPR : 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }])
  page.removeAllListeners('request'); page.removeAllListeners('response'); page.removeAllListeners('console'); page.removeAllListeners('pageerror')
  await page.setRequestInterception(true)
  page.on('request', (r) => {
    const u = r.url()
    if (u.startsWith('data:') || u.startsWith('blob:')) return r.continue()
    if (u.startsWith(base)) {
      if (fx.statsJson !== undefined && new URL(u).pathname === '/stats.json') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fx.statsJson) })
      return r.continue()
    }
    const { host, pathname } = new URL(u); urls.push(host + pathname)
    if (host === 'eu-assets.i.posthog.com') { hosts.push(host); return r.respond({ status: 200, contentType: 'text/javascript', headers: CORS, body: FAKE_POSTHOG }) }
    if (host === 'eu.i.posthog.com') { hosts.push(host); return r.respond({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' }) }
    if (host === GAME_HOST) {
      hosts.push(host)
      if (fx.live === 'error') return r.respond({ status: 500, contentType: 'application/json', headers: CORS, body: '{"error":"x"}' })
      if (fx.live === 'down') return r.abort()
      return r.respond({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(fx.live) })
    }
    bad.push(u); r.abort()
  })
  page.on('response', (r) => { if (r.url().startsWith(base) && r.status() >= 400) notFound.push(r.status() + ' ' + r.url()) })
  page.on('console', (m) => { if (m.type() !== 'error') return; if ((fx.live === 'error' || fx.live === 'down') && /Failed to load resource|net::ERR|CORS|blocked/.test(m.text())) return; errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.evaluateOnNewDocument((dnt) => {
    window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    if (dnt) Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' })
  }, !!fx.dnt)
  await page.goto(base + url, { waitUntil: 'networkidle0' })
  return { bad, errors, notFound, hosts, urls }
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
    ok(log.bad.length === 0, "no external request outside PostHog EU and the game server's /stats" + (log.bad.length ? ': ' + log.bad.join(', ') : ''))
    ok(['eu-assets.i.posthog.com', GAME_HOST].every((x) => log.hosts.includes(x)) && log.hosts.every((x) => [...POSTHOG_HOSTS, GAME_HOST].includes(x)), 'outside hosts contacted: ' + [...new Set(log.hosts)].join(', '))
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

// ---------- the «أرقام حقيقية» box: three data states, both pages, desktop and phone ----------
const NOW_ISO = '2026-10-05T10:30:00.000Z'
const SOON = { 'index.html': 'قريب', 'en.html': 'Soon' }
const MONTH = { 'index.html': 'أكتوبر', 'en.html': 'October' }
const SCENARIOS = [
  { name: 'values', fx: { statsJson: { visitors30d: 1234, igFollowers: 567, updatedAt: NOW_ISO }, live: { rooms: 3, players: 9, at: NOW_ISO } }, want: () => ['1,234', '567', '9'], dot: true, upd: true },
  { name: 'soon', fx: { statsJson: { visitors30d: null, igFollowers: null, updatedAt: null }, live: 'error' }, want: (p) => [SOON[p], SOON[p], '—'], dot: false, upd: false },
  { name: 'mixed', fx: { statsJson: { visitors30d: 98765, igFollowers: null, updatedAt: NOW_ISO }, live: { rooms: 0, players: 0, at: NOW_ISO } }, want: (p) => ['98,765', SOON[p], '0'], dot: true, upd: true },
]
for (const p of PAGES) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const sc of SCENARIOS) {
      console.log(`live ${p} ${w}x${h} real-numbers box: ${sc.name}`)
      const page = await browser.newPage()
      const log = await open(page, '/' + p, w, h, false, sc.fx)
      await page.evaluate(() => { window.__seen = []; const b = document.querySelector('.rt[data-k=visitors] b'); new MutationObserver(() => window.__seen.push(b.textContent)).observe(b, { childList: true, characterData: true, subtree: true }) })
      await page.evaluate(() => document.getElementById('real').scrollIntoView({ block: 'center' })); await sleep(2600)
      const r = await page.evaluate(() => {
        const box = document.querySelector('.realbox').getBoundingClientRect(); const u = document.querySelector('.upd')
        return {
          tiles: [...document.querySelectorAll('.rt')].map((t) => { const b = t.querySelector('b'); const dot = t.querySelector('.rdot'); return { k: t.dataset.k, state: t.dataset.state, text: b.textContent, dot: !!dot && getComputedStyle(dot).display !== 'none', over: b.scrollWidth > b.clientWidth + 1 || t.scrollWidth > t.clientWidth + 1, sh: t.getBoundingClientRect().height } }),
          upd: { hidden: getComputedStyle(u).visibility === 'hidden', text: u.textContent },
          left: box.left, right: box.right, iw: innerWidth, sw: document.documentElement.scrollWidth, seen: window.__seen, cls: window.__cls,
        }
      })
      const want = sc.want(p)
      ok(r.tiles.map((t) => t.text).join('|') === want.join('|'), `tiles read ${want.join(' | ')} (got ${r.tiles.map((t) => t.text).join(' | ')})`)
      ok(r.tiles.map((t) => t.state).join() === (sc.name === 'values' ? 'on,on,on' : sc.name === 'soon' ? 'soon,soon,off' : 'on,soon,on'), `tile states: ${r.tiles.map((t) => t.state).join()}`)
      ok(r.tiles.map((t) => t.dot).join() === [false, false, sc.dot].join(), `pulse dot only on the live tile and only while it has a count (${r.tiles.map((t) => t.dot).join()})`)
      ok(r.tiles.every((t) => !t.over) && r.left >= 0 && r.right <= r.iw && r.sw <= r.iw, `box and tiles fit the ${w}px viewport, no overflow`)
      ok(sc.upd ? !r.upd.hidden && r.upd.text.includes(MONTH[p]) && /\d{1,2}:\d{2}/.test(r.upd.text) : r.upd.hidden, `«last updated» ${sc.upd ? 'shows: ' + r.upd.text : 'stays hidden when there is nothing to date'}`)
      if (sc.name === 'values') ok(r.seen.length > 4 && r.seen[0] !== '1,234' && r.seen[r.seen.length - 1] === '1,234', `the visitors number counted up once on reveal (${r.seen.length} steps, ends at 1,234)`)
      ok(log.errors.length === 0 && log.bad.length === 0, 'no console error, no stray request' + (log.errors.length ? ': ' + log.errors.join(' | ') : ''))
      ok(r.cls < 0.05, `layout shift ${r.cls.toFixed(4)} < 0.05`)
      if (shotsDir) {
        await (await page.$('#real')).screenshot({ path: join(shotsDir, `real-${sc.name}-${p.replace('.html', '')}-${w}x${h}.png`) })
        if (sc.name === 'values') await page.screenshot({ path: join(shotsDir, `real-context-${p.replace('.html', '')}-${w}x${h}.png`) }) // the box in the page flow, between the stats strip and «how»
      }
      await page.close()
    }
  }
  console.log(`live ${p} real-numbers box: reduced motion shows the numbers at once, no pulse`)
  {
    const page = await browser.newPage()
    const log = await open(page, '/' + p, 390, 844, true, SCENARIOS[0].fx); await sleep(900)
    const r = await page.evaluate(() => ({ texts: [...document.querySelectorAll('.rt b')].map((b) => b.textContent), anims: document.getAnimations().length, vis: getComputedStyle(document.querySelector('.realbox')).opacity }))
    ok(r.texts.join('|') === '1,234|567|9' && r.anims === 0 && r.vis === '1' && log.errors.length === 0, `static numbers, nothing animating (${r.texts.join(' | ')})`)
    await page.close()
  }
  console.log(`live ${p} real-numbers box: the live tile asks the game server again every minute`)
  {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(() => { window.__ivs = []; const si = window.setInterval; window.setInterval = (f, ms, ...a) => { window.__ivs.push(ms); return si(f, ms, ...a) } })
    await open(page, '/' + p, 1440, 900, false, SCENARIOS[0].fx)
    ok((await page.evaluate(() => window.__ivs)).includes(60000), 'a 60 s interval is set for the live tile')
    await page.close()
  }
}

// ---------- analytics: the exact PostHog config, site_cta with the right `where`, Do Not Track ----------
for (const p of PAGES) {
  const lang = p === 'index.html' ? 'ar' : 'en'
  console.log(`live ${p} analytics`)
  let page = await browser.newPage()
  let log = await open(page, '/' + p, 1440, 900, false); await sleep(1500)
  const ph = await page.evaluate(() => window.__ph || null)
  ok(!!ph && ph.init.length === 1 && ph.init[0][0] === PH_KEY, 'the library was loaded from eu-assets.i.posthog.com and init ran once with the project key')
  const cfg = (ph && ph.init[0] && ph.init[0][1]) || {}
  ok(cfg.api_host === 'https://eu.i.posthog.com' && cfg.persistence === 'memory' && cfg.disable_session_recording === true && cfg.capture_pageview === true && cfg.capture_pageleave === true && cfg.person_profiles === 'never' && cfg.ip === false && cfg.respect_dnt === true
    && JSON.stringify(cfg.autocapture) === JSON.stringify({ dom_event_allowlist: ['click'], element_allowlist: ['a', 'button'] }), 'init config: EU host, memory persistence, no recording, pageview + pageleave, no profiles, no IP, clicks on a/button only')
  ok(!!ph && ph.registered.some((r) => r.surface === 'site' && r.lang === lang), `super properties: surface "site", lang "${lang}"`)
  const stored = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length, ck: document.cookie }))
  ok(stored.ls === 0 && stored.ss === 0 && stored.ck === '', 'no cookie, no localStorage, no sessionStorage')
  const timing = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const e = performance.getEntriesByName('https://eu-assets.i.posthog.com/static/array.js')[0]; return { load: n.loadEventStart, lib: e ? e.startTime : null } })
  ok(timing.lib !== null && timing.lib >= timing.load, `the library is requested after the load event (${Math.round(timing.lib)} ms >= ${Math.round(timing.load)} ms): it never blocks first paint`)
  await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a')) e.preventDefault() })) // bubble phase: runs after analytics.js, keeps the page here
  const clicks = await page.evaluate(() => [...document.querySelectorAll('a[data-cta]')].map((a) => { const n = window.__ph.captured.length; a.click(); return { where: a.dataset.cta, got: window.__ph.captured.slice(n) } }))
  ok(clicks.length === 6 && clicks.every((c) => c.got.length === 1 && c.got[0][0] === 'site_cta' && c.got[0][1].where === c.where && c.got[0][1].lang === lang && Object.keys(c.got[0][1]).sort().join() === 'lang,where'), `site_cta fires once per game Instagram link with { where, lang }: ${clicks.map((c) => c.where).join(', ')}`)
  ok([...new Set(clicks.map((c) => c.where))].sort().join() === 'custom,footer,hero,nav,play', 'where covers nav, hero, custom, play, footer')
  const other = await page.evaluate(() => { const n = window.__ph.captured.length; document.querySelector('a[href="#how"]').click(); return window.__ph.captured.length - n })
  ok(other === 0, 'a link that is not an Instagram link fires no site_cta')
  ok(log.errors.length === 0 && log.bad.length === 0, 'no console error, no stray request')
  await page.close()

  page = await browser.newPage()
  log = await open(page, '/' + p, 1440, 900, false, { dnt: true }); await sleep(1500)
  const dnt = await page.evaluate(() => ({ ph: typeof window.posthog, rec: typeof window.__ph, dnt: navigator.doNotTrack, clicked: (() => { const a = document.querySelector('a[data-cta]'); a.addEventListener('click', (e) => e.preventDefault()); a.click(); return true })() }))
  ok(dnt.dnt === '1' && dnt.ph === 'undefined' && dnt.rec === 'undefined' && !log.hosts.some((h) => POSTHOG_HOSTS.includes(h)), 'doNotTrack=1: the snippet does not load, no PostHog request is made')
  ok(log.errors.length === 0 && log.bad.length === 0 && dnt.clicked, 'doNotTrack=1: clicking an Instagram link is harmless, no console error')
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
