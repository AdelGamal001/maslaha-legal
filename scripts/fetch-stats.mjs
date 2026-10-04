// Run by .github/workflows/stats.yml (every 6 hours + by hand): writes stats.json for the «أرقام حقيقية» box on the landing page.
//   node scripts/fetch-stats.mjs
// Env (GitHub secrets):  POSTHOG_PERSONAL_API_KEY  (scope "Query Read", project 293009, EU cloud)
//                        IG_TOKEN                  (long-lived Instagram User token of the game's professional account)
// A missing secret or a failed call keeps the old number for that tile and never fails the job: the page shows «قريب» for a number that
// was never fetched. stats.json is only rewritten when a number changed. No dependencies (Node 20+: global fetch).
//   PostHog HogQL:  https://posthog.com/docs/api/queries   (POST /api/projects/:id/query/, Bearer personal key)
//   Instagram:      https://developers.facebook.com/docs/instagram-platform/reference/user  (followers_count)
//                   https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const POSTHOG_API = 'https://eu.posthog.com'
export const PROJECT_ID = 293009
export const SITE_HOST = 'maslahagame.com'
export const IG_API = 'https://graph.instagram.com'
export const VISITORS_QUERY = `SELECT count(DISTINCT properties.$session_id) FROM events WHERE event = '$pageview' AND properties.$host = '${SITE_HOST}' AND timestamp >= now() - INTERVAL 30 DAY`

const count = (v) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null }

/** The one number in a HogQL answer: `results: [[n]]` (rows are arrays) or `results: [{ ... }]` (rows are objects). */
export function visitorsOf(body) {
  const row = body && Array.isArray(body.results) ? body.results[0] : null
  if (Array.isArray(row)) return count(row[0])
  if (row && typeof row === 'object') return count(Object.values(row)[0])
  return null
}
export const followersOf = (body) => count(body && body.followers_count)

/** Merge fresh numbers into the old file: a null (tile skipped or failed) keeps what was there. Returns the file to write, or null when no number changed. */
export function mergeStats(old, fresh, now = new Date()) {
  const prev = { visitors30d: count(old && old.visitors30d), igFollowers: count(old && old.igFollowers) }
  const next = { visitors30d: fresh.visitors30d ?? prev.visitors30d, igFollowers: fresh.igFollowers ?? prev.igFollowers }
  if (next.visitors30d === prev.visitors30d && next.igFollowers === prev.igFollowers) return null
  return { ...next, updatedAt: now.toISOString() }
}

const note = (m) => console.log(m)
const warn = (m) => console.log(`::warning::${m}`) // a GitHub Actions annotation; on a laptop it is just a line

export async function fetchVisitors(env, fetchFn = fetch) {
  if (!env.POSTHOG_PERSONAL_API_KEY) { note('POSTHOG_PERSONAL_API_KEY is not set: keeping the old visitors number'); return null }
  try {
    const r = await fetchFn(`${POSTHOG_API}/api/projects/${PROJECT_ID}/query/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}` },
      body: JSON.stringify({ name: 'site-visitors-30d', query: { kind: 'HogQLQuery', query: VISITORS_QUERY } }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!r.ok) throw new Error(`PostHog answered ${r.status}`)
    const n = visitorsOf(await r.json())
    if (n === null) throw new Error('PostHog answered without a number')
    note(`visitors, last 30 days: ${n}`)
    return n
  } catch (e) { warn(`visitors not updated: ${e.message}`); return null }
}

export async function fetchFollowers(env, fetchFn = fetch) {
  if (!env.IG_TOKEN) { note('IG_TOKEN is not set: keeping the old followers number'); return null }
  try {
    const r = await fetchFn(`${IG_API}/me?fields=followers_count&access_token=${encodeURIComponent(env.IG_TOKEN)}`, { signal: AbortSignal.timeout(30_000) })
    if (!r.ok) throw new Error(`Instagram answered ${r.status}`)
    const n = followersOf(await r.json())
    if (n === null) throw new Error('Instagram answered without followers_count')
    note(`Instagram followers: ${n}`)
    return n
  } catch (e) { warn(`followers not updated: ${e.message}`); return null }
}

/**
 * Long-lived Instagram tokens last 60 days and can be refreshed once they are 24 hours old. Refresh on the first run of each UTC day
 * (and on a manual run), log the new expiry in the job summary. The token itself is never printed.
 */
export async function refreshToken(env, fetchFn = fetch, now = new Date()) {
  if (!env.IG_TOKEN) return null
  const due = now.getUTCHours() < 6 || env.GITHUB_EVENT_NAME === 'workflow_dispatch' || env.FORCE_REFRESH === '1'
  if (!due) { note('Instagram token refresh: not due on this run (once a day)'); return null }
  try {
    const r = await fetchFn(`${IG_API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(env.IG_TOKEN)}`, { signal: AbortSignal.timeout(30_000) })
    const body = await r.json().catch(() => ({}))
    if (!r.ok || !(body.expires_in > 0)) throw new Error(`refresh answered ${r.status}${body && body.error ? ` (${body.error.message || body.error.type || 'error'})` : ''}`)
    const until = new Date(now.getTime() + body.expires_in * 1000)
    const days = Math.round(body.expires_in / 86400)
    const line = `Instagram token refreshed: valid until ${until.toISOString().slice(0, 10)} (${days} days)`
    note(line)
    if (body.access_token && body.access_token !== env.IG_TOKEN) warn('Instagram returned a different token string: update the IG_TOKEN secret with a fresh token')
    if (days < 14) warn(`Instagram token expires in ${days} days: generate a new one and update the IG_TOKEN secret`)
    return { until: until.toISOString().slice(0, 10), days, line }
  } catch (e) {
    warn(`Instagram token not refreshed: ${e.message} (it can only be refreshed once it is 24 hours old)`)
    return null
  }
}

export async function main(env = process.env, root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), fetchFn = fetch, now = new Date()) {
  const file = join(root, 'stats.json')
  const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const [visitors30d, igFollowers] = await Promise.all([fetchVisitors(env, fetchFn), fetchFollowers(env, fetchFn)])
  const refreshed = await refreshToken(env, fetchFn, now)
  const out = mergeStats(old, { visitors30d, igFollowers }, now)
  if (out) { writeFileSync(file, JSON.stringify(out, null, 2) + '\n'); note('stats.json updated') } else note('no number changed: stats.json untouched')
  if (env.GITHUB_STEP_SUMMARY) {
    const rows = [`| visitors, 30 days | ${visitors30d ?? 'kept'} |`, `| Instagram followers | ${igFollowers ?? 'kept'} |`, `| Instagram token | ${refreshed ? `valid until ${refreshed.until} (${refreshed.days} days)` : 'not refreshed on this run'} |`]
    appendFileSync(env.GITHUB_STEP_SUMMARY, `### stats\n\n| | |\n|---|---|\n${rows.join('\n')}\n\n${out ? 'stats.json changed.' : 'stats.json unchanged.'}\n`)
  }
  return { out, visitors30d, igFollowers, refreshed }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main()
