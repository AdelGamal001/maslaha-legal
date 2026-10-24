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
import { parseLegalMd, UPDATED, GAME_SHA, GAME_SHA_SHORT, GAME_TREE, LEGAL_MD_PATH, COPY_PATH, treeKind, hasCommit, gameFile, rulesFile, crossCheckCopy, generate } from './gen-legal.mjs'
import { SITE_SECTIONS, PRIVACY_EN, TERMS_EN } from './legal-en.mjs'
import { LAUNCH, build as buildHome } from './gen-pages.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GAME = GAME_TREE
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
let skipped = 0 // pins that could not run on this machine (no game tree, no browser): counted, printed on the last line, and a failure under CI=true
const skipWhy = []
const skip = (n, why) => { skipped += n; skipWhy.push(`${n} ${why}`) }
// the last line: the result, how many pins were skipped, and the exit code (a skipped pin is a failure under CI=true: a green CI run must have run every pin)
function finish(passedMsg, failedWhat) {
  console.log(failed ? `\n${failed} ${failedWhat} FAILED` : `\n${passedMsg}`)
  const ci = process.env.CI === 'true'
  if (skipped) console.log(`${skipped} pins skipped (${skipWhy.join('; ')})${ci ? ': CI=true, so this run fails' : ''}`)
  process.exit(failed || (skipped && ci) ? 1 : 0)
}
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
{ // STORE-TEXT 24/10 (LOCAL item 10 + مشكك A بند 2): the home page has TWO states, BEFORE launch (published with the legal pages: no App Store link, because it is dead while the review runs) and AFTER launch
  // (the App Store text button, Google Play as plain text). gen-pages.mjs has the LAUNCH constant for the committed state and build(launch) for both; the committed index.html / en.html must be exactly build(LAUNCH).
  const APPLE = 'https://apps.apple.com/app/id6815344684'
  const B = buildHome(false); const A = buildHome(true)
  ok(JSON.stringify(Object.keys(B)) === JSON.stringify(PAGES) && JSON.stringify(Object.keys(A)) === JSON.stringify(PAGES), 'gen-pages.mjs builds exactly index.html and en.html in both states')
  for (const p of PAGES) ok(html[p] === buildHome(LAUNCH)[p], `${p} is exactly what gen-pages.mjs produces for LAUNCH = ${LAUNCH} (${LAUNCH ? 'AFTER' : 'BEFORE'} launch): nothing edited by hand, nothing stale`)
  for (const [p, soonH, soonIos, soonPlay, h, ios, play, metaBefore, metaAfter, customBefore, customAfter] of [
    ['index.html', 'اللعبة جاية قريب', 'على App Store', 'على Google Play', 'نزّل اللعبة', 'نزّلها من App Store', 'على Google Play قريب', 'قريب على iOS وأندرويد.', 'على iPhone دلوقتي، وأندرويد قريب.', 'ابعتلنا صورتك على إنستجرام', 'اطلب «اعمل شخصيتك» من متجر اللعبة، وابعتلنا 4 صور على إنستجرام أو الإيميل'],
    ['en.html', 'Coming soon', 'On the App Store', 'On Google Play', 'Get the game', 'Get it on the App Store', 'Coming soon to Google Play', 'Coming to iOS and Android.', 'Now on iPhone, coming soon to Android.', 'Send us your photo on Instagram', 'Buy “Make your character” in the game’s shop, send us 4 photos on Instagram or by email'],
  ]) {
    const blockOf = (t) => (/<div class="stores"[^>]*>([\s\S]*?)<\/div>/.exec(t) || ['', ''])[1]
    const before = B[p]; const after = A[p]
    const bb = blockOf(before)
    ok(bb.includes(`<b class="get-h">${soonH}</b>`) && bb.includes(`<span class="store">${soonIos}</span>`) && bb.includes(`<span class="store">${soonPlay}</span>`) && !/<a |apps\.apple\.com|data-cta|<img|<svg/.test(bb) && !before.includes('apps.apple.com') && before.includes(metaBefore) && !before.includes(metaAfter), `${p} BEFORE launch: the download block says «${soonH}» with two plain-text chips and NO link (no App Store URL anywhere on the page), and the meta still says «${metaBefore}»`)
    ok(before.includes('<span class="soon">') && before.includes('data-cta="custom"') && before.includes(customBefore) && !before.includes('href="#get"'), `${p} BEFORE launch: «شخصيتك بوشّك» keeps its soon badge and the Instagram button`)
    const ab = blockOf(after)
    ok(ab.includes(`<b class="get-h">${h}</b>`) && ab.includes(`<a class="btn" href="${APPLE}" rel="noopener noreferrer">${ios}</a>`) && !/data-cta|<img|<svg/.test(ab) && ab.includes(`<span class="store">${play}</span>`) && (ab.match(/<a /g) || []).length === 1 && (after.match(/apps\.apple\.com/g) || []).length === 1 && after.indexOf('class="hero"') < after.indexOf('id="get"') && after.indexOf('id="get"') < after.indexOf('id="real"'), `${p} AFTER launch: the download block «${h}» has the App Store link as a text button («${ios}»), no image, no data-cta, Google Play is plain text («${play}») with no link, and the block sits in the hero`)
    ok(after.includes(metaAfter) && !after.includes(metaBefore) && !after.includes('<span class="soon">') && after.includes('href="#get"') && !after.includes('data-cta="custom"') && after.includes(customAfter) && !after.includes(customBefore), `${p} AFTER launch: the meta says «${metaAfter}», «شخصيتك بوشّك» has no soon badge and no Instagram-first way to buy: it sends the visitor to the store button`)
    for (const [label, page] of [['BEFORE', before], ['AFTER', after]]) ok(!/يوم النزول|launch day|نرسمك|ونرسمك|Drawn by|we[’']ll draw|we draw|بتتجمع/.test(page) && /data-to="56"/.test(page) && !/data-to="58"/.test(page), `${p} ${label}: no launch-day promise, no «draw» for the AI character, no passive «بتتجمع», and the mini-game number is 56 (the 56 that are switched on)`)
  }
  ok(/min-height:54px/.test(read('home.css')) && /\.stores \.get-h\{/.test(read('home.css')), 'home.css: the shared .btn is 54 px tall (a tap target over 44 px) and the download heading has its rule')
}
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
  const wantCta = LAUNCH ? ['nav', 'hero', 'play', 'footer'] : ['nav', 'hero', 'custom', 'play', 'footer'] // AFTER launch the custom block sends the visitor to the store button, not to Instagram
  ok(wantCta.every((c) => cta.includes(c)) && (LAUNCH ? !cta.includes('custom') : true), `${p}: ${wantCta.join(', ')} are all covered${LAUNCH ? ' (AFTER launch: no data-cta custom)' : ''}`)
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
{ // SITE-2 · A: the Instagram token rotation. Instagram's refresh may answer with a NEW token string: it is handed to the store step through a file (never printed), so IG_TOKEN does not die after 60 days
  const fs = await import('./fetch-stats.mjs'); const { parseYaml } = await import('./lint-workflow.mjs')
  const { mkdtempSync, writeFileSync: wf, readFileSync: rf, copyFileSync, existsSync: ex, statSync: st2 } = await import('node:fs'); const { tmpdir } = await import('node:os')
  const rotate = async (expiresIn, tokenBack, over = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'rotate-')); copyFileSync(join(root, 'stats.json'), join(dir, 'stats.json'))
    const tokenFile = join(dir, 'ig-token'); const summary = join(dir, 'summary.md')
    const env = { IG_TOKEN: 'fake-token-old', POSTHOG_PERSONAL_API_KEY: 'fake', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_STEP_SUMMARY: summary, ...(over.noOut ? {} : { IG_TOKEN_OUT: tokenFile }) }
    const fetchFn = async (url) => {
      url = String(url)
      if (url.startsWith('https://eu.posthog.com/api/projects/293009/query/')) return new Response(JSON.stringify({ results: [[321]] }), { status: 200 })
      if (url.includes('/me?fields=followers_count')) { if (over.meThrows) throw new Error('boom ' + env.IG_TOKEN); return new Response(JSON.stringify({ followers_count: 4321 }), { status: 200 }) }
      if (url.includes('/refresh_access_token')) return new Response(JSON.stringify({ access_token: tokenBack, token_type: 'bearer', expires_in: expiresIn }), { status: 200 })
      throw new Error('unexpected url ' + url)
    }
    const out = []; const realLog = console.log; console.log = (...a) => out.push(a.join(' '))
    let res
    try { res = await fs.main(env, dir, fetchFn, new Date('2026-10-18T10:00:00Z')) } finally { console.log = realLog }
    const has = ex(tokenFile)
    return { res, out, stats: JSON.parse(rf(join(dir, 'stats.json'), 'utf8')), token: has ? rf(tokenFile, 'utf8') : null, mode: has ? st2(tokenFile).mode & 0o777 : null, summary: ex(summary) ? rf(summary, 'utf8') : '' }
  }
  const r1 = await rotate(9 * 86400, 'fake-token-new')
  ok(Number.isInteger(r1.stats.igFollowers) && r1.stats.igFollowers === 4321 && r1.stats.visitors30d === 321, 'token rotation: the pipeline writes the numbers as numbers (igFollowers 4321, visitors30d 321)')
  ok(r1.token === 'fake-token-new' && r1.res.refreshed.rotated === true && (process.platform === 'win32' || r1.mode === 0o600), 'token rotation: a new token string from Instagram lands in IG_TOKEN_OUT, exactly the string and nothing else, mode 0600')
  ok(r1.out.some((l) => /^::warning::Instagram token expires in 9 days/.test(l)), 'token rotation: fewer than 10 days left raises a ::warning:: (9 days)')
  ok(!r1.out.join('\n').includes('fake-token') && !r1.summary.includes('fake-token') && Object.keys(r1.res.refreshed).sort().join() === 'days,line,rotated,until', 'token rotation: neither the old nor the new token appears in the log, the job summary or the returned value')
  const r2 = await rotate(59 * 86400, 'fake-token-old')
  ok(r2.token === null && r2.res.refreshed.rotated === false && !r2.out.some((l) => /expires in/.test(l)) && r2.out.some((l) => /valid until 2026-12-16 \(59 days\)/.test(l)), 'token rotation: the same token string and 59 days left writes no file and raises no warning')
  const r2b = await rotate(12 * 86400, 'fake-token-old')
  ok(!r2b.out.some((l) => /expires in/.test(l)), 'token rotation: 12 days left is still quiet (the warning starts below 10 days)')
  const r3 = await rotate(59 * 86400, 'fake-token-new')
  ok(r3.token === 'fake-token-new' && !r3.out.some((l) => /expires in/.test(l)), 'token rotation: a new string is stored even when plenty of days are left (no 10-day warning)')
  const r4 = await rotate(59 * 86400, 'fake-token-new', { noOut: true })
  ok(r4.token === null && r4.res.refreshed.rotated === false && r4.out.some((l) => /IG_TOKEN_OUT is not set/.test(l)), 'token rotation: without IG_TOKEN_OUT a new string only raises a warning, nothing is written')
  const r5 = await rotate(59 * 86400, 'fake-token-old', { meThrows: true })
  ok(r5.out.some((l) => /followers not updated: boom \*\*\*/.test(l)) && !r5.out.join('\n').includes('fake-token'), 'token rotation: a stray error message that carries the token is masked in the log')
  // the workflow: the store step right after the fetch step, the PAT from SECRETS_PAT, the value only through stdin, nothing prints a token
  const yml = read('.github/workflows/stats.yml'); const steps = parseYaml(yml).jobs.stats.steps
  const fi = steps.findIndex((s) => /node scripts\/fetch-stats\.mjs/.test(s.run || '')); const store = steps[fi + 1] || {}
  ok(fi >= 0 && steps[fi].env.IG_TOKEN_OUT === '${{ runner.temp }}/ig-token' && store.name === 'Store the refreshed Instagram token' && store.env && store.env.GH_TOKEN === '${{ secrets.SECRETS_PAT }}', 'stats.yml: "Store the refreshed Instagram token" follows the fetch step, GH_TOKEN comes from secrets.SECRETS_PAT, IG_TOKEN_OUT is runner.temp/ig-token')
  ok(/timeout 60 gh secret set IG_TOKEN --repo "\$GITHUB_REPOSITORY" < "\$RUNNER_TEMP\/ig-token"/.test(store.run || '') && !/--body|-b\s|\|\s*gh\b/.test(store.run || ''), 'stats.yml: the secret is set with `timeout 60 gh secret set IG_TOKEN` and the value comes from stdin ($RUNNER_TEMP/ig-token), never from an argument or a pipe')
  // a line "prints" when a print verb starts it or follows `;` / `{`; what is checked is the part of the line from the verb on (a test like `if (!env.IG_TOKEN) { note('IG_TOKEN is not set') }` is fine)
  const printing = (text) => text.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1').replace(/^\s*[#*].*$/, '')).filter((l) => { const m = /\b(echo|printf|cat|tee|note|warn|console\.(?:log|info|warn|error))\b\s*\(?/.exec(l); return !!m && /\$\{?(GH_TOKEN|IG_TOKEN|SECRETS_PAT)\b|ig-token|\benv\.(IG_TOKEN|POSTHOG_PERSONAL_API_KEY)\b|access_token/.test(l.slice(m.index)) })
  const leaks = [...printing(yml).map((l) => 'stats.yml: ' + l.trim()), ...printing(code(read('scripts/fetch-stats.mjs'))).filter((l) => !/fetchFn\(|encodeURIComponent/.test(l)).map((l) => 'fetch-stats.mjs: ' + l.trim())]
  ok(leaks.length === 0, 'no echo / console.log line in stats.yml or fetch-stats.mjs references a token value' + (leaks.length ? ': ' + leaks.join(' | ') : ''))
  ok(store.if === 'always()' && (yml.match(/secrets\.SECRETS_PAT/g) || []).length === 1 && !/\bexit\s+[1-9]/.test(store.run || ''), 'stats.yml: the store step runs `if: always()`, never exits with a failure code, and is the only place that sees secrets.SECRETS_PAT (exactly once in the file)')
  // the store step run for real (bash -eo pipefail) in a temp folder: whatever happens, exit 0 and the token file is gone afterwards. PATH holds only rm, cat, timeout and, per case,
  // a stub `gh` that records its arguments and stdin: the real GitHub CLI is never reachable and nothing is stored anywhere
  const findTool = (n) => ['/usr/bin', '/bin', '/usr/local/bin'].map((d) => join(d, n)).find((f) => existsSync(f))
  const bashBin = findTool('bash'); const tools = ['rm', 'cat', 'timeout'].map(findTool)
  if (process.platform === 'win32' || !bashBin || tools.some((t) => !t)) { skipped += 6; warn('the store step is not run here (it needs bash, rm, cat and timeout on a POSIX system): its 6 behaviour pins are skipped') }
  else {
    const { mkdtempSync, writeFileSync: wf3, readFileSync: rf3, symlinkSync, mkdirSync: mk3, chmodSync } = await import('node:fs'); const { spawnSync } = await import('node:child_process'); const { tmpdir } = await import('node:os')
    const base = mkdtempSync(join(tmpdir(), 'store-')); const script = join(base, 'store.sh'); wf3(script, store.run)
    const attempt = (name, { file, pat, gh }) => {
      const dir = mkdtempSync(join(base, name + '-')); const bin = join(dir, 'bin'); const rt = join(dir, 'rt'); mk3(bin); mk3(rt)
      for (const t of tools) symlinkSync(t, join(bin, t.split('/').pop()))
      if (gh) { wf3(join(bin, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" > "${dir}/args"\ncat > "${dir}/stdin"\n${gh === 'fail' ? 'echo "stub: refused" >&2\nexit 1' : 'exit 0'}\n`); chmodSync(join(bin, 'gh'), 0o755) }
      if (file !== undefined) wf3(join(rt, 'ig-token'), file)
      const r = spawnSync(bashBin, ['-eo', 'pipefail', script], { env: { PATH: bin, RUNNER_TEMP: rt, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: pat }, encoding: 'utf8', cwd: dir, timeout: 30000 })
      const at = (f) => (existsSync(join(dir, f)) ? rf3(join(dir, f), 'utf8') : null)
      return { rc: r.status, out: (r.stdout || '') + (r.stderr || ''), gone: !existsSync(join(rt, 'ig-token')), args: at('args') && at('args').trim(), stdin: at('stdin') }
    }
    const NEW = 'fake-token-new'
    const c1 = attempt('nofile', { pat: 'fake-pat', gh: 'ok' }); ok(c1.rc === 0 && c1.gone && c1.args === null, 'store step, no token file: exit 0, `gh` is not called')
    const c2 = attempt('empty', { file: '', pat: 'fake-pat', gh: 'ok' }); ok(c2.rc === 0 && c2.gone && c2.args === null, 'store step, empty token file: exit 0, `gh` is not called, the file is removed')
    const c3 = attempt('nopat', { file: NEW, pat: '', gh: 'ok' }); ok(c3.rc === 0 && c3.gone && c3.args === null && /^::warning::SECRETS_PAT is not set/m.test(c3.out), 'store step, token file but no SECRETS_PAT: exit 0, a ::warning::, `gh` is not called, the file is removed')
    const c4 = attempt('ok', { file: NEW, pat: 'fake-pat', gh: 'ok' }); ok(c4.rc === 0 && c4.gone && c4.args === 'secret set IG_TOKEN --repo owner/repo' && c4.stdin === NEW && !c4.out.includes('fake-token'), 'store step, everything fine: `gh secret set IG_TOKEN --repo owner/repo` gets the token on stdin only (not in its arguments, not in the log), exit 0, the file is removed')
    const c5 = attempt('fail', { file: NEW, pat: 'fake-pat', gh: 'fail' }); ok(c5.rc === 0 && c5.gone && /^::warning::.*not stored/m.test(c5.out) && !c5.out.includes('fake-token'), 'store step, `gh` exits 1: still exit 0, a ::warning::, the file is removed')
    const c6 = attempt('nogh', { file: NEW, pat: 'fake-pat' }); ok(c6.rc === 0 && c6.gone && /^::warning::.*not stored/m.test(c6.out), 'store step, `gh` is not on PATH: still exit 0, a ::warning::, the file is removed')
  }
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
// SITE-2 · B: the Arabic text comes from ONE pinned game commit (GAME_SHA in gen-legal.mjs), read with `git show` and never from a working tree
const SITE_AR_LIST = ['site:الموقع', 'backup:النسخة الاحتياطية', 'rooms:الإدارة بتشوف الأوض', 'support-dm:لو دعمت القعدة']
const SITE_EN_LIST = ['site:This website', 'backup:Backups', 'rooms:Admin sees the rooms', 'support-dm:If you support us']
const footerOf = (t) => (/<footer>([\s\S]*?)<\/footer>/.exec(t) || ['', ''])[1]
ok(/^[0-9a-f]{40}$/.test(GAME_SHA) && GAME_SHA_SHORT === GAME_SHA.slice(0, 9), `gen-legal.mjs pins one game commit: ${GAME_SHA} (short ${GAME_SHA_SHORT})`)
for (const f of ['privacy.html', 'terms.html', 'privacy-en.html', 'terms-en.html']) {
  const label = /-en\.html$/.test(f) ? 'Text version:' : 'نسخة النص:'; const foot = footerOf(legalHtml[f])
  const m = new RegExp(`<p class="src">${label} <bdi dir="ltr">([0-9a-f]+)</bdi></p>`).exec(foot)
  ok(!!m && m[1] === GAME_SHA_SHORT && GAME_SHA.startsWith(m[1]) && plain(foot).endsWith(`${label} ${GAME_SHA_SHORT}`), `${f}: the footer says «${label} ${GAME_SHA_SHORT}» and that sha is the pinned GAME_SHA`)
}
const treeKindNow = treeKind(GAME)
let pin = null
if (treeKindNow === 'none') warn(`${GAME} is not a git checkout of the game repo (set SITE5_GAME_TREE): the pins that read the game at ${GAME_SHA_SHORT} are skipped`)
else if (!hasCommit(GAME_SHA, GAME)) ok(false, `the game tree ${GAME} does not contain the pinned commit ${GAME_SHA_SHORT}: run \`git fetch origin merge/0.2.8\` there (or point SITE5_GAME_TREE at a tree that has it)`)
else { const mdText = gameFile(LEGAL_MD_PATH); pin = { mdText, md: parseLegalMd(mdText), copy: gameFile(COPY_PATH), at: (p) => gameFile(p) } }
if (!pin) skip(16, `pins that read the game at ${GAME_SHA_SHORT} (text, allow-list, generator, cross-check, server facts, deletion quotes)`)
const enBody = (s) => norm(s.p.replace(/\[\[|\]\]/g, ''))
if (pin) {
  for (const [kind, file] of [['privacy', 'privacy.html'], ['terms', 'terms.html']]) {
    const page = sectionsOf(legalHtml[file]); const n = pin.md[kind].length; const body = page.slice(0, n)
    const same = body.length === n && body.every((x, i) => x.h === norm(pin.md[kind][i].h) && x.p === norm(pin.md[kind][i].p))
    ok(same, `${file}: ${n} sections equal legal-site.md at ${GAME_SHA_SHORT} word for word (headings and text, whitespace normalised)`)
    if (!same) { const i = body.findIndex((x, k) => !pin.md[kind][k] || x.h !== norm(pin.md[kind][k].h) || x.p !== norm(pin.md[kind][k].p)); console.log('    first difference at section ' + (i + 1) + ': ' + (body[i] || {}).h) }
    const allow = kind === 'privacy' ? SITE_SECTIONS : []; const rest = page.slice(n)
    ok(rest.length === allow.length && rest.every((x, i) => x.id === allow[i].id && x.h === norm(allow[i].ar.h) && x.p === norm(allow[i].ar.p)), `${file}: after the game text only the site-only sections follow (${allow.map((s) => s.id).join(', ') || 'none'}), in this order and word for word: the allow-list is SITE_SECTIONS in legal-en.mjs`)
  }
  const gen = generate(true)
  for (const f of Object.keys(gen)) ok(gen[f] === read(f), `${f} is exactly what gen-legal.mjs produces at ${GAME_SHA_SHORT} (nothing edited by hand, nothing stale)`)
  const cc = crossCheckCopy(pin.mdText, pin.md, pin.copy, rulesFile())
  ok(cc.bad.length === 0, `legal-site.md and src/game/copy.js agree at ${GAME_SHA_SHORT}: the date, ${pin.md.privacy.length} privacy and ${pin.md.terms.length} terms sections, every in-app paragraph found in legal-site.md` + (cc.bad.length ? ': ' + cc.bad.join('; ') : ''))
  for (const e of cc.extra) warn('legal-site.md says more than the in-app text: ' + e)
  // مشكك A بند 7: one date — the date inside the game text (TEXT.legal.updatedAt, legal-site.md) is the date the site shows on every page (UPDATED in gen-legal.mjs)
  const dateLines = [...pin.mdText.matchAll(/^آخر تحديث:.*$/gm)].map((m) => m[0].trim())
  ok(pin.copy.includes(`updatedAt: 'آخر تحديث: ${UPDATED.ar}'`) && dateLines.length === 2 && dateLines.every((l) => l === `آخر تحديث: ${UPDATED.ar}`), `the date is one date: updatedAt in the in-app text at ${GAME_SHA_SHORT} and both date lines of legal-site.md say «${UPDATED.ar}», the same as UPDATED in gen-legal.mjs (what the pages show)`)
}
{ // the English pages: PRIVACY_EN / TERMS_EN, then the same site-only sections; the section counts follow the pinned Arabic text
  const pe = sectionsOf(legalHtml['privacy-en.html']); const te = sectionsOf(legalHtml['terms-en.html'])
  const n = PRIVACY_EN.length; const rest = pe.slice(n)
  ok(pe.slice(0, n).every((x, i) => x.h === norm(PRIVACY_EN[i].h) && x.p === enBody(PRIVACY_EN[i])) && rest.length === SITE_SECTIONS.length && rest.every((x, i) => x.id === SITE_SECTIONS[i].id && x.h === norm(SITE_SECTIONS[i].en.h) && x.p === enBody(SITE_SECTIONS[i].en)), `privacy-en.html: ${n} sections of PRIVACY_EN, then the site-only sections of SITE_SECTIONS, word for word`)
  ok(te.length === TERMS_EN.length && te.every((x, i) => x.h === norm(TERMS_EN[i].h) && x.p === enBody(TERMS_EN[i])), `terms-en.html: ${te.length} sections of TERMS_EN, word for word`)
  if (pin) ok(n === pin.md.privacy.length && te.length === pin.md.terms.length, `the English pages have as many sections as legal-site.md at ${GAME_SHA_SHORT} (${pin.md.privacy.length} privacy, ${pin.md.terms.length} terms)`)
}
// SITE-2 · C: the site-only sections, in this order, at the end of both privacy pages
for (const [f, list] of [['privacy.html', SITE_AR_LIST], ['privacy-en.html', SITE_EN_LIST]]) {
  const tail = sectionsOf(legalHtml[f]).slice(-list.length)
  ok(tail.map((x) => x.id + ':' + x.h).join('|') === list.join('|'), `${f}: the last four sections are ${list.map((x) => '«' + x.split(':')[1] + '»').join(', ')} (ids site, backup, rooms, support-dm), after the game text`)
  ok(tail.every((x) => x.h.split(/\s+/).length <= 4), `${f}: the site-only headings are 4 words or fewer`)
}
{
  const sec = (f, id) => (sectionsOf(legalHtml[f]).find((x) => x.id === id) || { p: '' }).p
  const [bAr, bEn, rAr, rEn, dAr, dEn] = [sec('privacy.html', 'backup'), sec('privacy-en.html', 'backup'), sec('privacy.html', 'rooms'), sec('privacy-en.html', 'rooms'), sec('privacy.html', 'support-dm'), sec('privacy-en.html', 'support-dm')]
  ok(/30 يوم/.test(bAr) && /30 days/.test(bEn) && /AES-256/.test(bAr + bEn) && /GitHub/.test(bAr) && /GitHub/.test(bEn) && /3:10/.test(bAr) && /3:10/.test(bEn) && /كل بيانات اللاعيبة اللي بيخزّنها \(مش تقارير الأعطال\)/.test(bAr) && /all the player data it stores \(not the crash reports\)/.test(bEn) && /والحظر والأسامي المحجوبة وأرقام التشغيل اليومية وسجل الإدارة/.test(bAr) && /bans, blocked names, daily operating numbers, the admin log/.test(bEn) && /كل 6 ساعات/.test(bAr) && /Every 6 hours/.test(bEn) && /طلبات «اعمل شخصيتك» وفيها إيميل المشتري/.test(bAr) && /orders with the buyer’s email/.test(bEn), 'backup section (both languages): every 6 hours from 3:10 Cairo time, all the player data except crash reports (bans, the admin log and the «اعمل شخصيتك» orders with the buyer’s email included), AES-256, a private GitHub repository, the newest 30 days')
  ok(/docs\.github\.com\/site-policy\/privacy-policies\/github-general-privacy-statement/.test(bAr) && /docs\.github\.com\/site-policy\/privacy-policies\/github-general-privacy-statement/.test(bEn) && /وهو مزوّد للنسخ دي بس/.test(bAr) && /It is a provider for these backups only/.test(bEn) && !/مزوّد سادس|sixth provider/.test(bAr + bEn), 'backup section: GitHub is named as the provider of the backups only (no count), with its privacy statement')
  ok(/بتفضل في آخر نسخ المخزن لحد 30 يوم/.test(bAr) && /وبتفضل في تاريخ المخزن 90 يوم بالكتير/.test(bAr) && /صاحب اللعبة بينضّف التاريخ ده مرة كل شهر، ومحدش يفتحها من غير المفتاح/.test(bAr) && /والاسترجاع على السيرفر الحالي بيعيد تطبيق سجل المسح، فالحساب اللي سجّلنا مسحه مابيرجعش/.test(bAr) && /stays in the latest backups for up to 30 days, and in the repository’s history for 90 days at most/.test(bEn) && /The owner cleans that history once a month, and it cannot be opened without the key/.test(bEn) && /A restore on the current server replays our deletion log, so an account we recorded as deleted does not come back/.test(bEn), 'backup section (both languages): the newest copies stay up to 30 days, the repository history 90 days at most, the owner cleans it once a month, unreadable without the key, and a restore replays the deletions so a deleted account does not come back')
  ok(/ولازم يكتب السبب/.test(rAr) && /وعدد اللاعيبة والسبب/.test(rAr) && /must type a reason/.test(rEn) && /number of players and the reason/.test(rEn) && /12 حرف/.test(rAr) && /12 characters/.test(rEn) && /5 ثواني/.test(rAr) && /5 seconds/.test(rEn) && /مابتخزّنهاش/.test(rAr) && /not stored/.test(rEn), 'rooms section (both languages): a reason must be typed and is logged, the first 12 characters of a player number, refreshed every 5 seconds, the view is not stored')
  ok(/مدير المصلحة/.test(rAr) && /مدير المصلحة/.test(rEn) && /سنة/.test(rAr) && /one year/.test(rEn) && /ده لمنع الإساءة ولتشغيل الخدمة/.test(rAr) && /This is to stop abuse and to keep the service running/.test(rEn), 'rooms section: the owner can join a room as «مدير المصلحة», the log is kept one year, the purpose is to stop abuse and to keep the service running')
  ok(/90 يوم/.test(dAr) && /90 days/.test(dEn) && /maslaha_game/.test(dAr) && /maslaha_game/.test(dEn) && /privacycenter\.instagram\.com\/policy/.test(dAr) && /privacycenter\.instagram\.com\/policy/.test(dEn) && !/paypal|بايبال/i.test(dAr + dEn), 'support-dm section (both languages): the Instagram message is deleted after we reply or send the money back, or after 90 days at most, Instagram\'s own policy is linked, no PayPal')
  ok(/نتأكد إن التحويل وصل ونرد عليك، أو نرجّع الفلوس لو بعتّها بالغلط/.test(dAr) && /to confirm that the transfer arrived and reply to you, or to send the money back if you sent it by mistake/.test(dEn) && /الدعم اختياري، ومن غير أي مقابل جوه اللعبة/.test(dAr) && /Support is voluntary and gives nothing inside the game/.test(dEn) && !/الهدية|ربط إنستجرام|\bgift|Instagram linking/i.test(dAr + dEn), 'support-dm section: the message is for confirming the transfer or sending the money back, support gives nothing inside the game, and there is no gift or Instagram-link promise (STORE-TEXT 24/10)')
  { // 22/10 (LAUNCH-READY): store-forms.md F18/F19 and the Data-safety answer «request deletion without deleting the account» promise "written in the policy and the deletion page": photos, purchase receipt and buyer number are deleted on an email request
    const [phAr, phEn] = [sec('privacy.html', 'photos'), sec('privacy-en.html', 'photos')]
    const ASK_AR = 'تقدر تطلب مسح صورك ونسخة إيصال الشرا عند RevenueCat ورقم المشتري بإيميل على hello@maslahagame.com.'; const ASK_EN = 'You can ask us to delete your photos, the copy of your purchase receipt at RevenueCat and your buyer number by emailing hello@maslahagame.com.' // مشكك خارجي ج2 24/10 (بند 3): «نسخة … عند RevenueCat» — سجل البيع نفسه بنحتفظ بيه 5 سنين، فالإيصال اللي بيتمسح بالطلب هو نسخة RevenueCat
    const mail = '<a href="mailto:hello@maslahagame.com" dir="ltr">hello@maslahagame.com</a>'
    // PHOTO-AI (22/10 · App Store 5.1.2(i)): the AI disclosure comes FIRST in the section (who gets the photos), then the way to ask for deletion
    const AI_AR = 'لما تبعت صورك في «اعمل شخصيتك»، بنبعتها لـNover ومعالجها Runware عشان يعملوا شخصيتك. بنستخدمها لـ«اعمل شخصيتك» بس، إلا لو علّمت اختيار الاحتفاظ: ساعتها كمان لتطوير اللعبة ومنتجاتنا التانية. لو ماوافقتش على الاحتفاظ بصورك، بنمسحها من المحادثة والإيميل وNover خلال 30 يوم من التسليم. ولو وافقت، بنحتفظ بيها لحد ما تطلب مسحها. ولما تمسح حسابك، بنمسح صورك كمان، حتى لو كنت وافقت نحتفظ بيها.'
    const AI_EN = 'When you send us your photos for “Make your character”, we send them to Nover, whose processor is Runware, so that they make your character. We use them for “Make your character” only, unless you tick the keep-photos box: then also to develop the game and our other products. If you do not agree to our keeping your photos, we delete them from the chat, the email and Nover within 30 days of delivery. If you agree, we keep them until you ask us to delete them. When you delete your account, we delete your photos too, even if you agreed to our keeping them.'
    ok(phAr === `${AI_AR} ${ASK_AR}` && phEn === `${AI_EN} ${ASK_EN}` && /<section id="photos"><h2>صورك وإيصال الشرا<\/h2>/.test(legalHtml['privacy.html']) && /<section id="photos"><h2>Your photos and receipt<\/h2>/.test(legalHtml['privacy-en.html']), 'photos section (both privacy pages): the neutral sentence (we send the photos to Nover, whose processor is Runware, for «اعمل شخصيتك» only; deleted within 30 days of delivery if the player did not agree to keep them; kept until asked if he agreed; no «works for us» claim) and then «تقدر تطلب مسح صورك ونسخة إيصال الشرا عند RevenueCat ورقم المشتري بإيميل على hello@maslahagame.com» / “You can ask us to delete your photos, the copy of your purchase receipt at RevenueCat and your buyer number by emailing hello@maslahagame.com”, anchor #photos; STORE-TEXT 24/10 (مشكك A بند 1): the use is «اعمل شخصيتك» only unless the keep-photos box is ticked, and deleting the account deletes the photos too')
    { // the purchase section (the game text, mirrored word for word) says it too, in both languages: photos are made into the character with AI tools
      const byHeading = (f, h) => (sectionsOf(legalHtml[f]).find((x) => x.h === h) || { p: '' }).p
      const [bAr, bEn, cAr, cEn, mAr, mEn] = [byHeading('privacy.html', 'الشراء بفلوس حقيقية'), byHeading('privacy-en.html', 'Real-money purchases'), byHeading('privacy.html', 'اعمل شخصيتك'), byHeading('privacy-en.html', 'Make your character'), byHeading('privacy.html', 'إيميل الطلب'), byHeading('privacy-en.html', 'Order email')]
      ok(!/بنعمل شخصيتك من صورك|بنمسح إيميلك/.test(bAr) && !/we make your character from your pictures|Your email is deleted/.test(bEn), 'purchase section (both privacy pages): the photos and email sentences moved out into their own sections')
      ok(/بنعمل شخصيتك من صورك بأدوات ذكاء اصطناعي، وبنبعت الصور لـNover ومعالجها Runware عشان يعملوا شخصيتك/.test(cAr) && /We make your character from your pictures with artificial-intelligence tools, and we send the pictures to Nover, whose processor is Runware, so that they make your character/.test(cEn) && /فيه اختيار منفصل فاضي من الأول/.test(cAr) && /separate choice, empty at the start/.test(cEn) && /لو وافقت، بنحتفظ بصورك لحد ما تطلب مسحها بإيميل، وتقدر ترجع في موافقتك/.test(cAr) && /ولو ماوافقتش، بنمسحها من المحادثة والإيميل وNover خلال 30 يوم من التسليم/.test(cAr) && /within 30 days of delivery/.test(cEn) && /محتاجين موافقة ولي أمرك/.test(cAr) && /parent’s or guardian’s agreement/.test(cEn), 'section «اعمل شخصيتك» / “Make your character” (both privacy pages): Nover and its processor Runware, the separate empty choice, kept until asked if agreed, deleted within 30 days of delivery if not, the age-18 consent')
      ok(/بنجمع إيميلك لما نجهّز طلبك، حتى لو ماكملتش الشراء/.test(mAr) && /ولو الطلب لسه مفتوح، الإيميل بيفضل لحد ما الطلب يقفل أو تمسح حسابك/.test(mAr) && /We collect your email when we prepare your order, even if you do not finish the purchase/.test(mEn) && /If the order is still open, the email stays until the order closes or you delete your account/.test(mEn), 'section «إيميل الطلب» / “Order email” (both privacy pages): collected when the order is prepared even without the purchase, and the four cases')
      ok(/وبيبعتلنا RevenueCat سجل لكل بيعة أو استرداد: المنتج والسعر والدولة ورقم العملية في المتجر، من غير اسمك ولا رقم لاعبك\. بنستخدمه لحساباتنا وضرايبنا بس\. بنحتفظ بيه 5 سنين بعد الإقرار الضريبي للسنة اللي حصلت فيها البيعة، لأن قانون الضرايب المصري بيطلب نحتفظ بالدفاتر المدة دي\. وبعدها بنمسح رقم العملية\. «امسح حسابي» مابيمسحوش/.test(bAr) && /RevenueCat also sends us a record of every sale or refund: the product, the price, the country and the store’s transaction number, without your name or your player number\. We use it only for our accounts and taxes\. We keep it for 5 years after the tax return for the year of the sale, because Egyptian tax law requires us to keep our books that long, and then we delete the transaction number\. “Delete my account” does not delete it/.test(bEn), 'purchase section (both privacy pages): the RevenueCat sale record (product, price, country, store transaction number; no name, no player number) is used for accounts and taxes only, kept 5 years after the tax return for the year of the sale (Egyptian tax law), then the transaction number is deleted, and «امسح حسابي» does not delete it (مشكك خارجي ج2 24/10 بند 3; the code does not prune yet: server/src/store/revenue.ts, first deletion due about 2032)')
      ok(/ولما تمسح حسابك، بنمسح صورك كمان، حتى لو كنت وافقت نحتفظ بيها/.test(cAr) && /When you delete your account, we delete your pictures too, even if you agreed to our keeping them/.test(cEn) && /من غير إيميل ولا اسم \(إلا إيميل طلب «اعمل شخصيتك»، تحت\)/.test(sectionsOf(legalHtml['privacy.html'])[0].p) && /with no email and no name \(except the email of a “Make your character” order, below\)/.test(sectionsOf(legalHtml['privacy-en.html'])[0].p), 'sections (both privacy pages): deleting the account deletes the pictures too (RF4), and the first section keeps its email exception for the order email')
      ok(!/خمس شركات|الخمسة|مزوّد (?:سادس|زيادة)|بتشتغل لحسابنا/.test(legalHtml['privacy.html'] + legalHtml['account-deletion.html']) && !/five (?:companies|providers)|sixth provider|one more provider|works on our behalf/i.test(legalHtml['privacy-en.html'] + legalHtml['account-deletion-en.html']), 'privacy pages (both languages): no provider count, no «one more provider», and no «works for us» claim about the photo tools (the policy says «دول بيشتغلوا لحسابنا وبتعليماتنا» about the named providers only; the deletion pages count too)')
    }
    ok(legalHtml['account-deletion.html'].includes(`<p>${ASK_AR.replace('hello@maslahagame.com', mail)}</p>`) && legalHtml['account-deletion-en.html'].includes(`<p>${ASK_EN.replace('hello@maslahagame.com', mail)}</p>`) && /id="request"[\s\S]*صورك ونسخة إيصال الشرا عند RevenueCat[\s\S]*<\/section>/.test(legalHtml['account-deletion.html'].split('<section id="kept">')[0]) && /id="request"[\s\S]*your photos, the copy of your purchase receipt at RevenueCat[\s\S]*<\/section>/.test(legalHtml['account-deletion-en.html'].split('<section id="kept">')[0]), 'deletion pages (both languages): the same sentence, with the mailto link, inside the #request section')
    if (pin) ok(pin.copy.includes('اعمل شخصيتك: بنعمل شخصيتك من صورك بأدوات ذكاء اصطناعي، وبنبعت الصور لـNover ومعالجها Runware عشان يعملوا شخصيتك.') && pin.copy.includes('إيميل الطلب: بنجمع إيميلك لما نجهّز طلبك، حتى لو ماكملتش الشراء.'), `the in-app text at ${GAME_SHA_SHORT} has the two sections «اعمل شخصيتك» (Nover and its processor Runware) and «إيميل الطلب» that this page repeats in short`)
  }
  if (pin) { // what the site says about the server is what the server code at the pinned commit does
    const got = (path, re) => { try { return re.exec(pin.at(path)) } catch { return null } }
    const keep = got('server/src/backup/run.ts', /^\s*keep:.*: (\d+),\s*$/m); const at = got('server/src/config.ts', /at: \(process\.env\.BACKUP_AT \|\| '(\d\d:\d\d)'\)/); const every = got('server/src/config.ts', /everyHours: num\('BACKUP_EVERY_HOURS', (\d+)\)/)
    const poll = got('server/admin-web/js/tabs/rooms.js', /setInterval\(\(\) => (?:\{ if \(!document\.hidden\) )?load\(false\)(?: \})?, (\d+)\)/); const slice = got('server/src/admin/routes/rooms.ts', /player: p\.playerId\.slice\(0, (\d+)\)/); const aud = got('server/src/admin/audit.ts', /AUDIT_KEEP_MS = (\d+) \* 86_400_000/)
    ok(!!keep && +keep[1] === 30 && /30 يوم/.test(bAr) && /30 days/.test(bEn) && /لحد 30 يوم بعد المسح/.test(legalHtml['account-deletion.html']) && /up to 30 days after deletion/.test(legalHtml['account-deletion-en.html']), `backup keep: BACKUP_KEEP defaults to ${keep ? keep[1] : '?'} in server/src/backup/run.ts at ${GAME_SHA_SHORT}, the privacy and deletion pages (both languages) say 30 يوم / 30 days`)
    ok(!!at && /3:10/.test(bAr) && at[1].replace(/^0/, '') === '3:10' && !!every && +every[1] === 6 && /كل 6 ساعات/.test(bAr) && /Every 6 hours/.test(bEn), `backup time: BACKUP_AT defaults to ${at ? at[1] : '?'} (Cairo) and BACKUP_EVERY_HOURS to ${every ? every[1] : '?'} in server/src/config.ts, the pages say from 3:10 and every 6 hours`)
    ok(/aes-256-gcm/i.test(pin.at('server/src/backup/crypt.ts')) && /maslaha-backups/.test(pin.at('server/src/backup/run.ts')), 'backup: crypt.ts is AES-256-GCM and run.ts defaults to a repository named maslaha-backups (private per docs/backend/backup.md)')
    ok(!!poll && +poll[1] === 5000 && !!slice && +slice[1] === 12 && !!aud && +aud[1] === 365, `rooms: the dashboard polls every ${poll ? poll[1] : '?'} ms, a removal logs the first ${slice ? slice[1] : '?'} characters of the player id, the audit is kept ${aud ? aud[1] : '?'} days: the pages say 5 seconds, 12 characters, one year`)
  }
}
const secs = Object.fromEntries(LEGAL.map((f) => [f, sectionsOf(legalHtml[f])]))
for (const [a, e] of [['privacy.html', 'privacy-en.html'], ['terms.html', 'terms-en.html'], ['support.html', 'support-en.html'], ['account-deletion.html', 'account-deletion-en.html']]) {
  ok(secs[a].length === secs[e].length && secs[a].every((x, i) => x.id === secs[e][i].id), `${a} / ${e}: same number of sections and same anchors (${secs[a].length})`)
}
for (const f of LEGAL) {
  const t = legalHtml[f]
  ok(!/<script/i.test(t), `${f}: no script`)
  ok(!/https?:\/\/(?!(www\.instagram\.com|cloud-prod\.colyseus\.io|posthog\.com|www\.revenuecat\.com|docs\.github\.com|privacycenter\.instagram\.com|www\.cloudflare\.com|www\.nover\.studio|runware\.ai)\b)/i.test(t.replace(/<a [^>]*href="https?:[^>]*>/g, '')), `${f}: no external resource, only plain links`)
  ok(/-en\.html$|^privacy\.html$/.test(f) && /^privacy/.test(f) || !/docs\.github\.com|privacycenter\.instagram\.com/.test(t), `${f}: the GitHub and Instagram policy links (the only additions to the external-link allow-list) appear on the privacy pages only`)
  ok(t.includes('hello@maslahagame.com'), `${f}: official email present`)
  ok(t.includes(`datetime="${UPDATED.iso}"`) && t.includes(UPDATED[/-en\.html$/.test(f) ? 'en' : 'ar']), `${f}: updated ${UPDATED.iso}`)
}
ok(legalHtml['privacy.html'].includes('عادل جمال محمد عبد الله') && legalHtml['terms.html'].includes('عادل جمال محمد عبد الله'), 'privacy.html and terms.html name the data controller «عادل جمال محمد عبد الله»')
ok(legalHtml['privacy-en.html'].includes('Adel Gamal Mohamed Abdullah') && legalHtml['terms-en.html'].includes('Adel Gamal Mohamed Abdullah'), 'the English pages name him too')
ok(/<section id="delete">/.test(legalHtml['privacy.html']) && /<section id="delete">/.test(legalHtml['privacy-en.html']), 'privacy pages carry the #delete anchor (store answers link to privacy.html#delete)')
{ // SITE-2 · D: the delete step stands on its own: the real path in the app, quoted; no guide (it is hidden in the game); the backup line; the support pages agree
  const dAr = legalHtml['account-deletion.html']; const dEn = legalHtml['account-deletion-en.html']; const both = dAr + dEn
  const inOrder = (t, words) => words.every((w, i) => t.indexOf(w) > (i ? t.indexOf(words[i - 1]) : -1))
  ok(['الإعدادات', 'الحساب', 'امسح حسابي', 'مفيش رجوع', 'استرجاع المشتريات'].every((w) => dAr.includes(w) && dEn.includes(w)), 'deletion pages (both languages) name «الإعدادات», «الحساب», «امسح حسابي», the sheet text «مفيش رجوع» and «استرجاع المشتريات»')
  ok(inOrder(dAr, ['الخطوة الأولى', 'الخطوة التانية', 'الخطوة التالتة', 'الخطوة الرابعة']) && inOrder(dEn, ['Step one', 'Step two', 'Step three', 'Step four']), 'deletion pages: the four steps are numbered in words, in order (settings, account, «امسح حسابي», confirm)')
  ok(!/الدليل|\bguides?\b|عندك سؤال|امسح أرقام دليل/i.test(both), 'deletion pages do not send anyone to the guide «الدليل» (it is hidden in the game)')
  ok(!/امسح بياناتي|Delete my data|قبل 0\.2\.6|before 0\.2\.6|older versions/i.test(both), 'deletion pages: no «امسح بياناتي» and no line about builds before 0.2.6')
  ok(/رقم جهازك/.test(dAr) && /device number/i.test(dEn) && /id="request"/.test(dAr) && /id="request"/.test(dEn), 'deletion pages: the device-number request flow (#request) is still there')
  { // STORE-TEXT 24/10 (ح5 · ح7): the first section is the way to delete the ACCOUNT itself by email for someone who does not have the game
    const firstAr = sectionsOf(dAr)[0]; const firstEn = sectionsOf(dEn)[0]
    ok(firstAr.id === 'no-app' && firstAr.h === 'ماعندكش اللعبة؟' && firstEn.id === 'no-app' && firstEn.h === 'Don’t have the game?', 'deletion pages (both languages): the first section is «ماعندكش اللعبة؟» / “Don’t have the game?” (#no-app), before everything else')
    ok(/مسح حسابك نفسه/.test(firstAr.p) && /عنوان الرسالة «امسح حسابي»/.test(firstAr.p) && /«كود الاسترجاع» بتاعك، وهو 8 حروف/.test(firstAr.p) && /هنمسح الحساب خلال 30 يوم، وهنرد عليك/.test(firstAr.p) && /الكود بيشتغل 6 شهور من آخر مرة لعبت فيها/.test(firstAr.p) && /من غير الكود ممكن مانلاقيش الحساب\. ضيّعت الكود؟ ابعتلنا برضه/.test(firstAr.p) && /ابعت رقم الطلب من إيصال المتجر، وهنحاول نوصل للحساب/.test(firstAr.p) && /ولو مالقيناهوش، بنمسحه احنا بعد سنتين من آخر لعب، إلا لو فيه شرا بفلوس حقيقية/.test(firstAr.p) && /تقدر كمان تدخل بيه على موبايل جديد/.test(firstAr.p) && /مابنمسحوش بالوقت/.test(firstAr.p) && dAr.includes('<a href="mailto:hello@maslahagame.com" dir="ltr">hello@maslahagame.com</a>'), 'deletion page (Arabic) #no-app: email with the subject «امسح حسابي» and the 8-character recovery code as proof, 30 days and a reply, the code works 6 months from the last play, «ضيّعت الكود؟ ابعتلنا برضه» (with a purchase: the order number from the store receipt and we try; if we do not find it we delete it ourselves after two years unless it has a real-money purchase; signing in on a new phone is one option, not the only way), an account with a real-money purchase is not deleted by time (مشكك خارجي ج2 24/10 بند 7)')
    ok(/delete the account itself/.test(firstEn.p) && /subject “Delete my account”/.test(firstEn.p) && /recovery code in it. It has 8 characters/.test(firstEn.p) && /within 30 days, and reply to you/.test(firstEn.p) && /works for 6 months after you last played/.test(firstEn.p) && /Without the code, we may not find the account\. Lost the code\? Email us anyway/.test(firstEn.p) &&/send the order number from the store receipt, and we will try to reach the account/.test(firstEn.p) && /If we do not find it, we delete it ourselves two years after you last played, unless there is a real-money purchase on it/.test(firstEn.p) && /you can also sign in with it on a new phone/.test(firstEn.p) && /not deleted by time/.test(firstEn.p), 'deletion page (English) #no-app: the same facts')
    ok(/RECOVERY_CODE_DAYS = 180\b/.test(pin ? pin.at('src/game/shared/accountRules.js') : 'RECOVERY_CODE_DAYS = 180') && /ACCOUNT_MAX_AGE_DAYS', 730/.test(pin ? pin.at('server/src/config.ts') : "ACCOUNT_MAX_AGE_DAYS', 730"), 'the durations on the pages are the code: the recovery code works 180 days (6 months) after the last play, an idle account goes after 730 days (two years)')
    { // STORE-TEXT 24/10 (ح7, guard B): every sentence that says «two years» carries the real-money-purchase exception itself (an account with a purchase is never deleted by time, only when its owner asks). The game text mirrored from legal-site.md (the first sections of the two privacy pages) may say it in the very next sentence of the same section
      const EXC = /شر(?:ا|اء) بفلوس حقيقية|real-money purchase/
      const siteIds = new Set(SITE_SECTIONS.map((s) => s.id))
      const bad = []; let seen = 0
      for (const f of LEGAL) {
        const secsHtml = [...legalHtml[f].matchAll(/<section(?: id="([^"]*)")?>([\s\S]*?)<\/section>/g)]
        secsHtml.forEach((s, si) => {
          const ps = [...s[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => plain(x[1]))
          const gameText = /^privacy/.test(f) && !siteIds.has(s[1] || '')
          ps.forEach((p, i) => {
            if (!/سنتين|two years/.test(p)) return
            seen += 1
            if (!(EXC.test(p) || (gameText && EXC.test(ps[i + 1] || '')))) bad.push(`${f} section ${si + 1}: ${p.slice(0, 70)}`)
          })
        })
      }
      ok(seen >= 6 && bad.length === 0, `every «سنتين» / “two years” sentence on the 8 pages (${seen} found) names the real-money-purchase exception itself, or the next sentence does when it is the game's own policy text` + (bad.length ? ': ' + bad.join(' | ') : ''))
    }
  }
  ok(/<a href="privacy\.html#backup">نسخ المخزن<\/a> لحد 30 يوم بعد المسح/.test(dAr) && /وبتفضل في تاريخ المخزن 90 يوم بالكتير، وصاحب اللعبة بينضّفه مرة كل شهر/.test(dAr) && /<a href="privacy-en\.html#backup">backups<\/a> for up to 30 days after deletion/.test(dEn) && /in the repository’s history for 90 days at most, and the owner cleans that history once a month/.test(dEn), 'deletion pages carry the backup line: the encrypted copy stays in the newest backups up to 30 days after deletion, and may stay longer in the repository history until the owner cleans it (links to #backup)')
  ok(/امسح حسابي/.test(legalHtml['support.html']) && /Delete my account/.test(legalHtml['support-en.html']) && !/امسح بياناتي|Delete my data/.test(legalHtml['support.html'] + legalHtml['support-en.html']), 'support pages say «امسح حسابي» / “Delete my account” (not «امسح بياناتي»)')
  ok(!/إجراء|موظف بمزاج/.test(dAr + dEn + legalHtml['support.html'] + legalHtml['support-en.html'] + SITE_SECTIONS.map((s) => s.ar.p + s.ar.h).join(' ')), 'no «إجراء» or «موظف بمزاج» on the deletion and support pages or in the site-only sections (the landing page and the game\'s own legal text are not touched here)')
  if (pin) { // the quoted words are the words the app shows at the pinned commit
    const settings = pin.copy.slice(pin.copy.indexOf('\n  settings: {')) // TEXT.settings: the first `title:` and the delete* keys below it
    const str = (k) => { const m = new RegExp('\\n    ' + k + ": '([^']*)'").exec(settings); return m ? m[1] : null }
    const [title, account, del, sheet, detail, yes, restore] = [str('title'), str('account'), str('delete'), str('deleteConfirm'), str('deleteDetail'), str('deleteYes'), str('restore')]
    ok(title === 'الإعدادات' && account === 'الحساب' && del === 'امسح حسابي' && yes === 'امسح حسابي' && dAr.includes(sheet) && dAr.includes(detail) && dEn.includes(sheet) && dEn.includes(detail) && /«اعمل شخصيتك»/.test(detail), `the deletion pages quote the app at ${GAME_SHA_SHORT}: Settings «${title}» › «${account}» › «${del}», the sheet «${sheet}» and «${detail}»`)
    ok(/\bcodex: false\b/.test(pin.at('src/game/features.js')) && /^\s*restore: 'استرجاع المشتريات'/m.test(pin.copy) && /id: 'account', label: t\.account/.test(pin.at('src/screens/Settings.jsx')), 'game facts behind the pages: features.codex is false (the guide is hidden), the shop button is «استرجاع المشتريات», Settings has an «الحساب» tab')
  }
}
ok(!/مش بينفّذ حذف|does not currently delete/.test(legalHtml['account-deletion.html'] + legalHtml['account-deletion-en.html']), 'deletion pages no longer say the delete button does nothing')
{ // STORE-TEXT 24/10 (مشكك خارجي ج2 · بنود 3 4 5 6 8): the sentences that changed after the second outside review, in both languages, on the privacy pages and the deletion pages
  const named = (f, h) => (sectionsOf(legalHtml[f]).find((x) => x.h === h) || { p: '' }).p
  const APPLE_AR = 'ده بيحصل لما تمسح من جوه اللعبة على آيفون وتأكد بآبل. لو قفلت شاشة آبل، أو مسحت بالإيميل، مانقدرش نلغي الربط من عندنا. الغيه انت من إعدادات آيفون › اسمك › Sign in with Apple › قعدة مصلحة › Delete.' // 5ج: آخر خطوة «Delete» زي صفحة آبل support.apple.com/en-us/102571 (والعربي ar-ae/102571)، فتحناهم 24/10
  const APPLE_EN = 'This happens when you delete from inside the game on iPhone and confirm with Apple. If you close Apple’s sheet, or delete by email, we cannot cancel the link from our side: stop it yourself in iPhone Settings › your name › Sign in with Apple › Qaadet Maslaha › Delete.'
  ok(named('privacy.html', 'مسح الحساب').includes('ونعيد الطلب لحد 3 مرات لو فشل. ' + APPLE_AR) && named('privacy-en.html', 'Deleting your account').includes('up to 3 times if it fails. ' + APPLE_EN), 'privacy pages (both languages) «مسح الحساب» / “Deleting your account”: right after «لحد 3 مرات لو فشل» the Apple sentence (it happens when you delete from inside the game on iPhone and confirm with Apple; if you close Apple’s sheet or delete by email we cannot cancel the link; stop it yourself in iPhone Settings › your name › Sign in with Apple)')
  const noApp = (f) => (sectionsOf(legalHtml[f]).find((x) => x.id === 'no-app') || { p: '' }).p
  ok(noApp('account-deletion.html').includes('ولو حسابك مربوط بآبل، بنطلب من آبل تلغي الربط. ' + APPLE_AR) && noApp('account-deletion-en.html').includes('If your account is linked to Apple, we ask Apple to cancel the link. ' + APPLE_EN), 'deletion pages (both languages) #no-app: the same Apple sentence, after one sentence that says we ask Apple to cancel the link')
  const [kAr, kEn] = [(sectionsOf(legalHtml['account-deletion.html']).find((x) => x.id === 'kept') || { p: '' }).p, (sectionsOf(legalHtml['account-deletion-en.html']).find((x) => x.id === 'kept') || { p: '' }).p]
  ok(kAr.includes('بنستخدمه لحساباتنا وضرايبنا بس. بنحتفظ بيه 5 سنين بعد الإقرار الضريبي للسنة اللي حصلت فيها البيعة، لأن قانون الضرايب المصري بيطلب نحتفظ بالدفاتر المدة دي. وبعدها بنمسح رقم العملية. و«امسح حسابي» مابيوصلهوش.') && kEn.includes('We use it only for our accounts and taxes. We keep it for 5 years after the tax return for the year of the sale, because Egyptian tax law requires us to keep our books that long, and then we delete the transaction number. “Delete my account” does not reach it.'), 'deletion pages (both languages) #kept: the sale record is used for accounts and taxes only, kept 5 years after the tax return for the year of the sale (Egyptian tax law), then the transaction number is deleted')
  ok(!/«اعمل شخصيتك» مش هترجع/.test(legalHtml['privacy.html'] + legalHtml['account-deletion.html']) && !/can then no longer be restored/.test(legalHtml['privacy-en.html'] + legalHtml['account-deletion-en.html']) && /ونمسحه بإيدنا\./.test(legalHtml['privacy.html']) && /ونمسحهم بإيدنا\./.test(legalHtml['account-deletion.html']), 'privacy and deletion pages: no «اعمل شخصيتك مش هترجع» / “can then no longer be restored” after a hand deletion at RevenueCat (the claim is unproven; مشكك خارجي ج2 بند 8)')
  const [cAr, cEn] = [named('privacy.html', 'الأطفال'), named('privacy-en.html', 'Children')]
  ok(!/مابنجمعش بيانات منهم عن قصد/.test(cAr) && !/do not knowingly collect/.test(cEn) && /وبنجمع بس اللي اللعبة محتاجاه عشان تشتغل: نسخة حسابك/.test(cAr) && /we collect only what the game needs to work: your account copy/.test(cEn) && /بنقفل الإحصائيات والشراء بفلوس وطلبات الأصحاب والأوضة العامة/.test(cAr) && /we turn off statistics, real-money purchases, friend requests and public rooms/.test(cEn) && /Cloudflare\. وسجل «صحابك» \(اسمك وشخصيتك وكود صاحبك\) لو دخلت أوضة أونلاين أو فتحت «صحابك»\./.test(cAr) && /Cloudflare\. And your “Friends” record \(your name, character and friend code\) if you join an online room or open “Friends”\./.test(cEn), 'privacy pages (both languages) «الأطفال» / “Children”: no «we do not knowingly collect data» claim; if the answer is no we turn off statistics, real-money purchases, friend requests and public rooms and collect only what the game needs to work, and the list names the «صحابك» record (name, character, friend code) that an online room or the «صحابك» screen registers (friendsClient.js:461-466, Friends.jsx:69, friendsServer.js:138-141; مشكك خارجي ج2 بند 4 + 5ج)')
}
{ // POLICY-GENERAL (24/10, Adel): Workers Logs on the Worker stay ON, so no page promises «no logs» at Cloudflare any more; the pages say what is kept, and the first section of the policy says what the data is used for
  const byHead = (f, h) => (sectionsOf(legalHtml[f]).find((x) => x.h === h) || { p: '' }).p
  const byId = (f, id) => (sectionsOf(legalHtml[f]).find((x) => x.id === id) || { p: '' }).p
  const [LOG_AR, LOG_EN] = ['والمزوّدين دول، ومنهم Cloudflare، بيحتفظوا بسجلات تشغيل لفترة قصيرة (زي الوقت والرابط وعنوان النت والمكان التقريبي ونوع الجهاز)، عشان الخدمة تشتغل ونلاقي الأعطال ونمنع التلاعب.',
    'These providers, Cloudflare included, keep operating logs for a short time (such as the time, the link, your internet address, your approximate location and your device type), so the service runs and we can find faults and stop abuse.']
  const [CF_AR, CF_EN] = ['وبتحفظ لنا سجل قصير بكل طلب (زي الوقت والرابط وعنوان النت والمكان التقريبي ونوع الجهاز) عشان نلاقي الأعطال، وممكن تحتفظ بسجلات تانية حسب سياستها.',
    'It keeps a short log of each request for us (such as the time, the link, your internet address, your approximate location and your device type) so we can find faults, and it may keep other logs under its own policy.']
  const [USE_AR, USE_EN] = ['بنستخدم البيانات اللي في الصفحة دي عشان نشغّل اللعبة ونحميها ونصلّح أعطالها ونحسّنها.', 'We use the data on this page to run the game, protect it, fix its faults and improve it.']
  const [KEPT_AR, KEPT_EN] = ['وسجلات التشغيل عند المزوّدين (زي Cloudflare) بتفضل لحد ما هما يمسحوها لوحدهم بعد فترة قصيرة.', 'Operating logs at our providers (such as Cloudflare) stay until the providers delete them on their own after a short time.']
  ok(byHead('privacy.html', 'مزوّدين الخدمة').includes(LOG_AR) && byHead('privacy-en.html', 'Service providers').includes(LOG_EN) && byId('privacy.html', 'providers').includes(CF_AR) && byId('privacy-en.html', 'providers').includes(CF_EN), 'privacy pages (both languages) «مزوّدين الخدمة» / “Service providers” and #providers: the providers, Cloudflare included, keep short operating logs (time, link, internet address, approximate country, device type), and Cloudflare keeps a short log of each request for us (POLICY-GENERAL)')
  ok(byHead('privacy.html', 'الأطفال').includes('وعنوان النت بتاعك وسجلات التشغيل القصيرة عند Cloudflare.') && byHead('privacy-en.html', 'Children').includes('your internet address and short operating logs at Cloudflare.'), 'privacy pages (both languages) «الأطفال» / “Children”: the list names the short operating logs at Cloudflare next to the internet address')
  ok(byHead('privacy.html', 'الدخول اختياري').endsWith(USE_AR) && byHead('privacy-en.html', 'Signing in is optional').endsWith(USE_EN), 'privacy pages (both languages) first section «الدخول اختياري» / “Signing in is optional”: it ends with the one general sentence on what the data is used for (run, protect, fix, improve the game)')
  ok(!LEGAL.some((f) => /مابيحفظش حاجة ولا بيكتب لوج|مابيحفظش ولا بيكتب لوج|stores nothing and writes no log|writes no log/.test(legalHtml[f])), 'no legal page promises that Cloudflare or our code on it keeps no logs (Workers Logs stay on, Adel 24/10)')
  ok(byId('account-deletion.html', 'kept').endsWith(KEPT_AR) && byId('account-deletion-en.html', 'kept').endsWith(KEPT_EN), 'deletion pages (both languages) #kept: the last paragraph says operating logs at the providers (such as Cloudflare) stay until the providers delete them on their own after a short time')
}
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
  const [games, ads, chars, players] = statsOf(html['index.html'])
  // مشكك A بند 5: the page says the games a player can reach, not every row of the plan: two rows are `stage: 0` (skyscrapers, wordle: locked in the code, no remote value turns them on)
  const planRows = [...readFileSync(join(GAME, 'src/game/minigamePlan.js'), 'utf8').matchAll(/^\s+\w+:\s+\{ stage: ([0-5]),/gm)].map((m) => +m[1])
  const switchedOn = planRows.filter((s) => s !== 0).length
  ok(games === switchedOn && switchedOn === mod.COUNTS.games - planRows.filter((s) => s === 0).length, `minigames ${games} = the plan rows that are switched on (${switchedOn} of ${planRows.length}; clerkManifest counts ${mod.COUNTS.games} with the stage-0 rows)`)
  ok(ads === 0, 'ads 0 (the game shows no ads)')
  const roomMax = +(/roomMaxPlayers: (\d+)/.exec(readFileSync(join(GAME, 'src/game/tuning.js'), 'utf8')) || [])[1]
  ok(players === roomMax, `max players ${players} = tuning.roomMaxPlayers ${roomMax}`)
  const stats = readFileSync(join(GAME, 'src/game/stats.js'), 'utf8'); const tun = readFileSync(join(GAME, 'src/game/tuning.js'), 'utf8')
  const ids = [...stats.matchAll(/^\s*\{ id: 'c(\d+)'/gm)].map((m) => +m[1])
  const list = (re) => [...(re.exec(tun) || ['', ''])[1].matchAll(/'c(\d+)'/g)].map((m) => +m[1])
  const hidden = new Set([...list(/hidden: \[([^\]]*)\]/), ...list(/future: \[([^\]]*)\]/)])
  const visible = ids.filter((n) => !hidden.has(n)).length
  const c63 = ids.includes(63)
  ok(chars === visible + (c63 ? 0 : 1), `characters ${chars} = visible roster ${visible}${c63 ? '' : ' + c63 (CHAR63 not merged in this tree yet)'}`)
} catch (e) { warn('game-tree facts not checked: ' + e.message); skip(4, 'landing-page fact pins (clerkManifest, tuning, stats)') }

// ---------- live checks ----------
if (process.argv.includes('--static')) finish('static checks passed', 'static check(s)')
const req = createRequire(join(GAME, 'package.json'))
let puppeteer
for (const spec of [join(root, 'node_modules/puppeteer-core'), 'puppeteer-core']) { try { puppeteer = createRequire(import.meta.url)(spec); break } catch { /* next */ } }
if (!puppeteer) { try { puppeteer = req('puppeteer-core') } catch { /* none */ } }
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => p && existsSync(p))
if (!puppeteer || !CHROME) { warn('puppeteer-core or Chrome not found: live checks skipped'); skip(1, 'live part (needs puppeteer-core and Chrome)'); finish('static checks passed, live part not run', 'check(s)') }

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
  // wait for two painted frames after every step: the reveals and the ink line are IntersectionObservers, and a slow machine that skips frames skips markers.
  // The page height is read again at every step (lazy images below the fold grow the page while it is scrolled), and the last step is the very bottom.
  const height = () => page.evaluate(() => document.documentElement.scrollHeight)
  const to = (yy) => page.evaluate((y) => { scrollTo({ top: y, behavior: 'instant' }); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) }, yy) // home.css has scroll-behavior: smooth: a smooth scroll never catches up with steps this fast
  for (let y = 0; y < await height(); y += 240) { await to(y); await sleep(40) }
  await to(await height()); await sleep(600)
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
  ok(clicks.length === (LAUNCH ? 5 : 6) && clicks.every((c) => c.got.length === 1 && c.got[0][0] === 'site_cta' && c.got[0][1].where === c.where && c.got[0][1].lang === lang && Object.keys(c.got[0][1]).sort().join() === 'lang,where'), `site_cta fires once per game Instagram link with { where, lang }: ${clicks.map((c) => c.where).join(', ')}`)
  ok([...new Set(clicks.map((c) => c.where))].sort().join() === (LAUNCH ? 'footer,hero,nav,play' : 'custom,footer,hero,nav,play'), `where covers ${LAUNCH ? 'nav, hero, play, footer' : 'nav, hero, custom, play, footer'}`)
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
    if (/^(https?:|data:)/.test(h)) { if (!/^https:\/\/(www\.instagram\.com\/(maslaha_game|_othman_007_|adelgamal001)|maslahagame\.com\/|apps\.apple\.com\/app\/id6815344684$)/.test(h)) { bad++; console.log('    unexpected external link ' + h) } continue }
    if (h.startsWith('#')) { if (!ids.has(h.slice(1))) { bad++; console.log('    missing anchor ' + h) } continue }
    const res = await fetch(base + '/' + h).catch(() => null)
    if (!res || res.status >= 400) { bad++; console.log('    404 ' + h) }
  }
  ok(bad === 0, `${p}: ${hrefs.length} href/src values resolve`)
}
await browser.close(); server.close()
finish('all site5 checks passed', 'check(s)')
