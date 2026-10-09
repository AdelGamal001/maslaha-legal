// Dev-only: writes privacy.html / privacy-en.html / terms.html / terms-en.html.
//   node scripts/gen-legal.mjs [path/to/legal-site.md]
// The Arabic text is copied word for word from the game repo's docs/release/legal-site.md (the public mirror of TEXT.legal);
// the English text is scripts/legal-en.mjs. No dependencies, no network. The site has no build step: the output is committed.
// scripts/check-site5.mjs pins the Arabic bodies to legal-site.md, so a change in the game text shows up as a failed check.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRIVACY_EN, TERMS_EN, SITE_AR, SITE_EN } from './legal-en.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const GAME = process.env.SITE5_GAME_TREE || 'G:/Work Space/maslahtak2/worktrees/maslahtak-merge-meta'
const RUN = !!process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
export const LEGAL_MD = resolve((RUN && process.argv[2]) || join(GAME, 'docs/release/legal-site.md'))

export const UPDATED = { iso: '2026-10-09', ar: '9 أكتوبر 2026', en: '9 October 2026' }
const IG = 'https://www.instagram.com/maslaha_game'
const PROVIDERS = { 'cloud-prod.colyseus.io/privacy-policy': 'https://cloud-prod.colyseus.io/privacy-policy', 'posthog.com/privacy': 'https://posthog.com/privacy', 'revenuecat.com/privacy': 'https://www.revenuecat.com/privacy' }

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
    lang: 'ar', dir: 'rtl', home: 'index.html', skip: 'روح للمحتوى', navLabel: 'صفحات الموقع', eyebrow: 'معلومات اللعبة', updated: 'آخر تحديث:',
    other: { text: 'English', lang: 'en', dir: 'ltr' }, nav: ['الرئيسية', 'الخصوصية', 'الشروط', 'الدعم', 'حذف البيانات'], brand: 'قعدة مصلحة',
    footer: 'قعدة مصلحة · معلومات واضحة عن اللعب وبياناتك.', related: [['account-deletion.html', 'حذف البيانات'], ['support.html', 'الدعم']],
  },
  en: {
    lang: 'en', dir: 'ltr', home: 'en.html', skip: 'Skip to content', navLabel: 'Site pages', eyebrow: 'Game information', updated: 'Updated:',
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
<footer><p>${L.footer}</p></footer>
</div>
</body>
</html>
`
}

if (RUN) {
  if (!existsSync(LEGAL_MD)) throw new Error('legal-site.md not found at ' + LEGAL_MD + ' (pass its path as the first argument)')
  const { privacy, terms } = parseLegalMd(readFileSync(LEGAL_MD, 'utf8'))
  if (privacy.length !== PRIVACY_EN.length || terms.length !== TERMS_EN.length) throw new Error(`legal-site.md has ${privacy.length}/${terms.length} sections, legal-en.mjs has ${PRIVACY_EN.length}/${TERMS_EN.length}: update the English text too`)
  // the Arabic privacy page = legal-site.md + the «الموقع» section (unless legal-site.md already carries it) + id="delete" on «مسح البيانات»
  const withIds = (list) => list.map((s) => (['مسح البيانات', 'مسح الحساب'].includes(s.h) ? { ...s, id: 'delete' } : s))
  const arPrivacy = withIds(privacy); if (!arPrivacy.some((s) => s.h === SITE_AR.h)) arPrivacy.push(SITE_AR)
  const out = {
    'privacy.html': page('privacy', 'ar', arPrivacy, true),
    'privacy-en.html': page('privacy', 'en', [...PRIVACY_EN, SITE_EN], true),
    'terms.html': page('terms', 'ar', terms, false),
    'terms-en.html': page('terms', 'en', TERMS_EN, false),
  }
  for (const [f, html] of Object.entries(out)) { writeFileSync(join(root, f), html); console.log('wrote ' + f + ' (' + html.length + ' bytes)') }
}
