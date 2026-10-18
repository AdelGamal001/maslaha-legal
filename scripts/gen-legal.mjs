// Dev-only: writes privacy.html / privacy-en.html / terms.html / terms-en.html.
//   node scripts/gen-legal.mjs                regenerate the four pages
//   node scripts/gen-legal.mjs --pin <sha>    re-pin: rewrite GAME_SHA below to <sha> (a short sha or a branch name is expanded), then regenerate
// The Arabic text is copied word for word from the game repo's docs/release/legal-site.md (the public mirror of TEXT.legal in src/game/copy.js) AT THE
// PINNED COMMIT, read with `git show <sha>:<path>`: never from a working tree, so the site cannot drift with a branch that moves. The English text is
// scripts/legal-en.mjs, the site-only sections are SITE_SECTIONS there. The game tree only has to contain the commit (any worktree or clone of
// maslahtak): set SITE5_GAME_TREE, or it falls back to the Windows default below. No dependencies, no network. The site has no build step: the output is committed.
// scripts/check-site5.mjs pins the Arabic bodies to the same `git show`, so a change in the game text shows up as a failed check.
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRIVACY_EN, TERMS_EN, SITE_SECTIONS } from './legal-en.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SELF = fileURLToPath(import.meta.url)
const RUN = !!process.argv[1] && SELF === resolve(process.argv[1])

// The maslahtak commit the published text is taken from. To re-pin: change this line, run `node scripts/gen-legal.mjs`, commit the four pages
// (or run `node scripts/gen-legal.mjs --pin <sha>`, which does the first two steps).
export const GAME_SHA = 'f48eb1852ec1155451d9fa0e9ad980bf83629df3'
export const GAME_SHA_SHORT = GAME_SHA.slice(0, 9)
export const GAME_TREE = process.env.SITE5_GAME_TREE || 'G:/Work Space/maslahtak2/worktrees/maslahtak-merge-meta'
export const LEGAL_MD_PATH = 'docs/release/legal-site.md'
export const COPY_PATH = 'src/game/copy.js'

// The date shown on the pages («آخر تحديث» / «Updated:»): the day the text was published. The hand-written support and deletion pages carry the same date.
export const UPDATED = { iso: '2026-10-18', ar: '18 أكتوبر 2026', en: '18 October 2026' }
const IG = 'https://www.instagram.com/maslaha_game'
const PROVIDERS = {
  'cloud-prod.colyseus.io/privacy-policy': 'https://cloud-prod.colyseus.io/privacy-policy',
  'posthog.com/privacy': 'https://posthog.com/privacy',
  'revenuecat.com/privacy': 'https://www.revenuecat.com/privacy',
  'docs.github.com/site-policy/privacy-policies/github-general-privacy-statement': 'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement',
  'privacycenter.instagram.com/policy': 'https://privacycenter.instagram.com/policy',
}

// ---- the game tree: only ever read through `git show <sha>:<path>` ----
/** 'git' = SITE5_GAME_TREE is a git checkout, 'none' = it is not (or git is missing) */
export function treeKind(tree = GAME_TREE) {
  try { execFileSync('git', ['-C', tree, 'rev-parse', '--git-dir'], { stdio: 'pipe' }); return 'git' } catch { return 'none' }
}
export function hasCommit(sha = GAME_SHA, tree = GAME_TREE) {
  try { execFileSync('git', ['-C', tree, 'cat-file', '-e', `${sha}^{commit}`], { stdio: 'pipe' }); return true } catch { return false }
}
export const gameFile = (path, sha = GAME_SHA, tree = GAME_TREE) => execFileSync('git', ['-C', tree, 'show', `${sha}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
/** a readable reason when the pinned commit cannot be read from the tree, or null */
export function treeProblem(sha = GAME_SHA, tree = GAME_TREE) {
  if (treeKind(tree) === 'none') return `${tree} is not a git checkout of the game repo (set SITE5_GAME_TREE to a worktree or clone of maslahtak)`
  if (!hasCommit(sha, tree)) return `commit ${sha.slice(0, 9)} is not in ${tree}: run \`git fetch origin merge/0.2.8\` there (or in any clone of maslahtak)`
  return null
}

// ---- reading legal-site.md: "## سياسة الخصوصية" and "## الشروط والأحكام", each a list of "### heading" + one paragraph ----
export function parseLegalMd(md) {
  md = md.replace(/\r\n/g, '\n')
  const part = (title) => {
    const m = new RegExp('^## ' + title + '\\s*$', 'm').exec(md)
    if (!m) throw new Error('legal-site.md has no "## ' + title + '" section')
    const rest = md.slice(m.index + m[0].length)
    const end = rest.search(/^## /m)
    return end < 0 ? rest : rest.slice(0, end)
  }
  const sections = (body) => body.split(/^### /m).slice(1).map((chunk) => {
    const nl = chunk.indexOf('\n')
    const text = chunk.slice(nl + 1).replace(/^---\s*$/gm, '').trim().split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
    return { h: chunk.slice(0, nl).trim(), p: text.join(' ') }
  })
  return { privacy: sections(part('سياسة الخصوصية')), terms: sections(part('الشروط والأحكام')) }
}

// ---- the cross-check against the game's own copy.js (TEXT.legal): the date and every section, read with a tiny string lexer (no eval) ----
function readQuoted(src, at, facts) {
  const q = src[at]; let out = ''
  for (let i = at + 1; i < src.length; i++) {
    const c = src[i]
    if (c === '\\') { const n = src[++i]; if (n === 'u' || n === 'x') throw new Error('copy.js: a \\u or \\x escape in the legal text is not supported by the cross-check'); out += n === 'n' ? '\n' : n === 't' ? '\t' : n; continue }
    if (c === q) return { value: out, end: i + 1 }
    if (q === '`' && c === '$' && src[i + 1] === '{') {
      const close = src.indexOf('}', i); const expr = src.slice(i + 2, close).trim()
      const m = /^LEGAL_FACTS\.(name|email|instagram)$/.exec(expr)
      if (!m) throw new Error('copy.js: the legal text uses a template expression the cross-check does not know: ${' + expr + '}')
      out += facts[m[1]]; i = close; continue
    }
    if (q !== '`' && c === '\n') break
    out += c
  }
  throw new Error('copy.js: an unterminated string in the legal text')
}
function arrayStrings(src, at, facts) {
  const out = []; let i = at + 1
  for (;;) {
    while (i < src.length && /[\s,]/.test(src[i])) i++
    if (src.startsWith('//', i)) { i = src.indexOf('\n', i); if (i < 0) break; continue }
    if (src.startsWith('/*', i)) { i = src.indexOf('*/', i) + 2; continue }
    const c = src[i]
    if (c === ']') return out
    if (c === "'" || c === '"' || c === '`') { const r = readQuoted(src, i, facts); out.push(r.value); i = r.end; continue }
    throw new Error('copy.js: an element of the legal text is not a plain string (offset ' + i + '): the cross-check cannot read it')
  }
  throw new Error('copy.js: the legal text array does not end')
}
/** `{ updatedAt, contact, policy: string[], terms: string[] }` from the source of src/game/copy.js (TEXT.legal) */
export function parseCopyLegal(src) {
  const fb = /export const LEGAL_FACTS = Object\.freeze\(\{([\s\S]*?)\}\)/.exec(src)
  if (!fb) throw new Error('copy.js has no LEGAL_FACTS')
  const facts = {}
  for (const k of ['name', 'email', 'instagram']) { const m = new RegExp('\\b' + k + ": '([^']*)'").exec(fb[1]); if (!m) throw new Error('copy.js: LEGAL_FACTS.' + k + ' not found'); facts[k] = m[1] }
  const at = src.search(/^  legal: \{$/m)
  if (at < 0) throw new Error('copy.js has no TEXT.legal block')
  const rest = src.slice(at)
  const find = (key, open) => { const m = new RegExp('\\n    ' + key + ': ' + open).exec(rest); if (!m) throw new Error('copy.js: TEXT.legal.' + key + ' not found'); return m.index + m[0].length - 1 }
  return {
    updatedAt: readQuoted(rest, find('updatedAt', "'"), facts).value,
    contact: readQuoted(rest, find('contact', '`'), facts).value,
    policy: arrayStrings(rest, find('policy', '\\['), facts),
    terms: arrayStrings(rest, find('terms', '\\['), facts),
  }
}
const norm = (t) => t.replace(/\s+/g, ' ').trim()
/**
 * `{ bad, extra }`. `bad` (empty = fine): the «آخر تحديث» line(s) of legal-site.md equal updatedAt in copy.js; the section count and every heading match; and
 * every copy.js paragraph (`heading: paragraph`, templates resolved) is found inside the same section of legal-site.md. That is the direction the game's own
 * check-legal6 pins (`md.includes(body)`): the site must never show OLDER text than the app. `extra` lists sections where legal-site.md says MORE than copy.js
 * (at 9707294c7: the «الاحترام» terms section carries the one-day automatic lock sentence that the in-app text lacks): a note, not a failure.
 */
export function crossCheckCopy(mdText, md, copySrc) {
  const bad = []; const extra = []
  let copy
  try { copy = parseCopyLegal(copySrc) } catch (e) { return { bad: [e.message], extra } }
  const dates = [...mdText.matchAll(/^آخر تحديث:.*$/gm)].map((m) => norm(m[0]))
  if (!dates.length || dates.some((d) => d !== norm(copy.updatedAt))) bad.push(`the «آخر تحديث» line of legal-site.md (${dates.join(' / ') || 'none'}) differs from updatedAt in copy.js (${norm(copy.updatedAt)})`)
  for (const [kind, arr] of [['privacy', [...copy.policy, copy.contact]], ['terms', [...copy.terms, copy.contact]]]) {
    const want = arr.map((x) => { const k = x.indexOf(': '); return { h: norm(x.slice(0, k)), p: norm(x.slice(k + 2)) } })
    if (want.length !== md[kind].length) { bad.push(`${kind}: legal-site.md has ${md[kind].length} sections, copy.js has ${want.length}`); continue }
    want.forEach((w, i) => {
      const m = md[kind][i]; const mp = norm(m.p)
      if (norm(m.h) !== w.h) bad.push(`${kind} section ${i + 1}: heading «${norm(m.h)}» in legal-site.md, «${w.h}» in copy.js`)
      else if (!mp.includes(w.p)) bad.push(`${kind} section ${i + 1} («${w.h}»): the paragraph in copy.js is not in legal-site.md`)
      else if (mp !== w.p) extra.push(`${kind} «${w.h}»: legal-site.md has ${mp.length - w.p.length} more characters than copy.js`)
    })
  }
  return { bad, extra }
}

// ---- html helpers ----
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const sentences = (t) => t.split(/(?<=\.)\s+/).filter(Boolean)
function inline(t) {
  let s = esc(t)
  s = s.replace(/\[\[(.+?)\]\]/g, '<bdi lang="ar" dir="rtl">$1</bdi>')
  s = s.replace(/hello@maslahagame\.com/g, '<a href="mailto:hello@maslahagame.com" dir="ltr">hello@maslahagame.com</a>')
  for (const [u, href] of Object.entries(PROVIDERS)) s = s.split(u).join(`<a href="${href}" dir="ltr" rel="noopener noreferrer">${u}</a>`)
  s = s.replace(/\bmaslaha_game\b/g, `<a href="${IG}" dir="ltr" rel="noopener noreferrer">maslaha_game</a>`)
  return s
}
const sectionHtml = ({ h, p, id }) => `<section${id ? ` id="${id}"` : ''}><h2>${esc(h)}</h2>${sentences(p).map((x) => `<p>${inline(x)}</p>`).join('')}</section>`

const PAGE = {
  ar: {
    lang: 'ar', dir: 'rtl', home: 'index.html', skip: 'روح للمحتوى', navLabel: 'صفحات الموقع', eyebrow: 'معلومات اللعبة', updated: 'آخر تحديث:', version: 'نسخة النص:',
    other: { text: 'English', lang: 'en', dir: 'ltr' }, nav: ['الرئيسية', 'الخصوصية', 'الشروط', 'الدعم', 'حذف البيانات'], brand: 'قعدة مصلحة',
    footer: 'قعدة مصلحة · معلومات واضحة عن اللعب وبياناتك.', related: [['account-deletion.html', 'حذف البيانات'], ['support.html', 'الدعم']],
  },
  en: {
    lang: 'en', dir: 'ltr', home: 'en.html', skip: 'Skip to content', navLabel: 'Site pages', eyebrow: 'Game information', updated: 'Updated:', version: 'Text version:',
    other: { text: 'العربي', lang: 'ar', dir: 'rtl' }, nav: ['Home', 'Privacy', 'Terms', 'Support', 'Data deletion'], brand: 'Qaadet Maslaha',
    footer: 'Qaadet Maslaha · Clear information about playing and your data.', related: [['account-deletion-en.html', 'Data deletion'], ['support-en.html', 'Support']],
  },
}
const FILES = { privacy: ['privacy.html', 'privacy-en.html'], terms: ['terms.html', 'terms-en.html'], support: ['support.html', 'support-en.html'], deletion: ['account-deletion.html', 'account-deletion-en.html'] }
const TITLES = {
  privacy: { ar: 'سياسة الخصوصية', en: 'Privacy policy' },
  terms: { ar: 'شروط الاستخدام', en: 'Terms of use' },
}

function page(kind, lang, sections, withRelated) {
  const L = PAGE[lang]; const other = lang === 'ar' ? 'en' : 'ar'
  const t = TITLES[kind][lang]; const file = FILES[kind][lang === 'ar' ? 0 : 1]; const otherFile = FILES[kind][lang === 'ar' ? 1 : 0]
  const nav = [L.home, FILES.privacy[lang === 'ar' ? 0 : 1], FILES.terms[lang === 'ar' ? 0 : 1], FILES.support[lang === 'ar' ? 0 : 1], FILES.deletion[lang === 'ar' ? 0 : 1]]
    .map((f, i) => `<a href="${f}"${f === file ? ' aria-current="page"' : ''}>${L.nav[i]}</a>`).join('')
  const brandName = lang === 'ar' ? 'قعدة مصلحة' : 'Qaadet Maslaha'
  const desc = `${t} · ${brandName}`
  const date = `<time datetime="${UPDATED.iso}"${lang === 'en' ? ' dir="ltr"' : ''}>${UPDATED[lang]}</time>`
  return `<!doctype html>
<html lang="${L.lang}" dir="${L.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<meta name="description" content="${desc}">
<title>${t} | ${brandName}</title>
<link rel="stylesheet" href="styles.css">
<link rel="alternate" hreflang="${other}" href="${otherFile}">
</head>
<body>
<a class="skip" href="#content">${L.skip}</a>
<div class="shell">
<header>
<a class="brand" href="${L.home}">${L.brand}</a>
<a class="language" href="${otherFile}" lang="${L.other.lang}" dir="${L.other.dir}" hreflang="${L.other.lang}">${L.other.text}</a>
</header>
<nav aria-label="${L.navLabel}">${nav}</nav>
<main id="content" tabindex="-1">
<p class="eyebrow">${L.eyebrow}</p>
<h1>${t}</h1>
<p class="updated">${L.updated} ${date}</p>
${sections.map(sectionHtml).join('\n')}
${withRelated ? `<p class="related">${L.related.map(([h, x]) => `<a href="${h}">${x}</a>`).join(' · ')}</p>\n` : ''}</main>
<footer><p>${L.footer}</p><p class="src">${L.version} <bdi dir="ltr">${GAME_SHA_SHORT}</bdi></p></footer>
</div>
</body>
</html>
`
}

/** The four pages as { file: html }, from the text at GAME_SHA. Throws when the tree cannot give the commit, or when the game's own two copies of the text disagree. */
export function generate(quiet = false) {
  const problem = treeProblem()
  if (problem) throw new Error(problem)
  const mdText = gameFile(LEGAL_MD_PATH)
  const { privacy, terms } = parseLegalMd(mdText)
  const { bad, extra } = crossCheckCopy(mdText, { privacy, terms }, gameFile(COPY_PATH))
  if (bad.length) throw new Error(`legal-site.md and src/game/copy.js disagree at ${GAME_SHA_SHORT}:\n  ` + bad.join('\n  '))
  if (!quiet) for (const e of extra) console.log('note: ' + e)
  if (privacy.length !== PRIVACY_EN.length || terms.length !== TERMS_EN.length) throw new Error(`legal-site.md has ${privacy.length}/${terms.length} sections, legal-en.mjs has ${PRIVACY_EN.length}/${TERMS_EN.length}: update the English text too`)
  for (const s of SITE_SECTIONS) if ([...privacy, ...terms].some((m) => m.h === s.ar.h)) throw new Error(`legal-site.md now carries «${s.ar.h}»: remove it from SITE_SECTIONS in legal-en.mjs`)
  // the Arabic privacy page = legal-site.md + the site-only sections + id="delete" on «مسح الحساب»; the English one = PRIVACY_EN + the same sections
  const withIds = (list) => list.map((s) => (['مسح البيانات', 'مسح الحساب'].includes(s.h) ? { ...s, id: 'delete' } : s))
  return {
    'privacy.html': page('privacy', 'ar', [...withIds(privacy), ...SITE_SECTIONS.map((s) => ({ id: s.id, ...s.ar }))], true),
    'privacy-en.html': page('privacy', 'en', [...PRIVACY_EN, ...SITE_SECTIONS.map((s) => ({ id: s.id, ...s.en }))], true),
    'terms.html': page('terms', 'ar', terms, false),
    'terms-en.html': page('terms', 'en', TERMS_EN, false),
  }
}

if (RUN) {
  const i = process.argv.indexOf('--pin')
  if (i >= 0) {
    const want = process.argv[i + 1]
    if (!want) throw new Error('--pin needs a commit: node scripts/gen-legal.mjs --pin <sha>')
    let full = ''
    try { full = execFileSync('git', ['-C', GAME_TREE, 'rev-parse', '--verify', '--quiet', `${want}^{commit}`], { encoding: 'utf8' }).trim() } catch { /* reported below */ }
    if (!/^[0-9a-f]{40}$/.test(full)) throw new Error(`${want} is not a commit in ${GAME_TREE} (set SITE5_GAME_TREE; \`git fetch origin merge/0.2.8\` first)`)
    const src = readFileSync(SELF, 'utf8'); const next = src.replace(/^export const GAME_SHA = '[0-9a-f]{40}'/m, `export const GAME_SHA = '${full}'`)
    if (next === src) console.log(`already pinned to ${full.slice(0, 9)}`); else { writeFileSync(SELF, next); console.log(`pinned ${full.slice(0, 9)}`) }
    process.exit(spawnSync(process.execPath, [SELF], { stdio: 'inherit' }).status ?? 1) // a fresh process reads the new constant
  }
  for (const [f, html] of Object.entries(generate())) { writeFileSync(join(root, f), html); console.log('wrote ' + f + ' (' + html.length + ' bytes)') }
}
