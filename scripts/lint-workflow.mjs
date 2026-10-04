// Dev-only: a small YAML reader (maps, lists, scalars, `|` blocks, comments: all the workflow uses) and a schema sanity check for
// .github/workflows/stats.yml, because actionlint is not installed here. It throws on malformed indentation or tabs, so a broken file fails
// the check instead of failing silently on GitHub. Not a general YAML parser.
//   node scripts/lint-workflow.mjs [file]
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function parseYaml(text) {
  if (/\t/.test(text)) throw new Error('tab character: YAML indents with spaces')
  const L = text.replace(/\r/g, '').split('\n')
  let i = 0
  const ind = (s) => s.length - s.trimStart().length
  const skip = () => { while (i < L.length && (!L[i].trim() || L[i].trim().startsWith('#'))) i++ }
  const fail = (m) => { throw new Error(`line ${i + 1}: ${m}`) }
  const scalar = (s) => {
    s = s.trim()
    if (/^"/.test(s)) { const m = /^"((?:[^"\\]|\\.)*)"/.exec(s); if (!m) fail('unterminated string'); return m[1] }
    if (/^'/.test(s)) { const m = /^'((?:[^']|'')*)'/.exec(s); if (!m) fail('unterminated string'); return m[1].replace(/''/g, "'") }
    s = s.replace(/\s+#.*$/, '')
    if (s === '' || s === '~' || s === 'null') return null
    if (s === 'true') return true
    if (s === 'false') return false
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
    return s
  }
  function blockScalar(base) {
    const lines = []
    while (i < L.length && (!L[i].trim() || ind(L[i]) > base)) lines.push(L[i++])
    const inner = lines.filter((l) => l.trim()).map(ind)
    const cut = inner.length ? Math.min(...inner) : 0
    return lines.map((l) => l.slice(cut)).join('\n').replace(/\n+$/, '') + '\n'
  }
  function value(base) {
    skip()
    if (i >= L.length) return null
    const here = ind(L[i]); const dash = L[i].trim().startsWith('- ') || L[i].trim() === '-'
    if (here > base || (here === base && dash)) return dash ? seq(here) : map(here)
    return null
  }
  function map(base) {
    const obj = {}
    for (;;) {
      skip()
      if (i >= L.length) break
      const here = ind(L[i]); const t = L[i].trim()
      if (here < base) break
      if (here > base) fail('unexpected indentation')
      if (t.startsWith('- ')) break
      const m = /^([^\s:#'"][^:]*?):(?:\s+(.*))?$/.exec(t)
      if (!m) fail(`not a "key: value" line: ${t.slice(0, 40)}`)
      const [, k, rest] = m
      if (k in obj) fail(`duplicate key ${k}`)
      i++
      if (rest === undefined || rest === '' || rest.startsWith('#')) obj[k] = value(base)
      else if (/^[|>][+-]?\s*(#.*)?$/.test(rest)) obj[k] = blockScalar(base)
      else obj[k] = scalar(rest)
    }
    return obj
  }
  function seq(base) {
    const arr = []
    for (;;) {
      skip()
      if (i >= L.length || ind(L[i]) !== base || !(L[i].trim().startsWith('- ') || L[i].trim() === '-')) break
      const after = L[i].trim().slice(1).trim()
      if (after === '') { i++; arr.push(value(base)); continue }
      if (/^[^\s:#'"][^:]*?:(\s|$)/.test(after)) { L[i] = ' '.repeat(base + 2) + after; arr.push(map(base + 2)) } else { i++; arr.push(scalar(after)) }
    }
    return arr
  }
  const doc = map(0)
  skip()
  if (i < L.length) fail('unexpected content')
  return doc
}

const SECRETS = ['POSTHOG_PERSONAL_API_KEY', 'IG_TOKEN']
/** Schema sanity for the stats workflow: returns a list of problems (empty = fine). */
export function lintWorkflow(text, root) {
  const bad = []
  let y
  try { y = parseYaml(text) } catch (e) { return ['does not parse: ' + e.message] }
  if (y.name !== 'stats') bad.push('name is not "stats"')
  const on = y.on || y[true]
  const cron = on && on.schedule && on.schedule[0] && on.schedule[0].cron
  if (!cron || !/^(\*|\*\/\d+|\d+(,\d+)*) (\*|\*\/\d+|\d+(,\d+)*) \* \* \*$/.test(cron)) bad.push('on.schedule[0].cron is missing or not a 5-field cron: ' + cron)
  else if (cron.split(' ')[1] !== '*/6') bad.push('cron should run every 6 hours (*/6)')
  if (!on || !('workflow_dispatch' in on)) bad.push('on.workflow_dispatch is missing (no manual run)')
  if (!y.permissions || y.permissions.contents !== 'write') bad.push('permissions.contents must be write (the job commits stats.json)')
  if (!y.concurrency || !y.concurrency.group) bad.push('concurrency.group is missing')
  const job = y.jobs && y.jobs.stats
  if (!job) return bad.concat('jobs.stats is missing')
  if (job['runs-on'] !== 'ubuntu-latest') bad.push('runs-on is not ubuntu-latest')
  if (!(job['timeout-minutes'] > 0)) bad.push('timeout-minutes is missing')
  const steps = Array.isArray(job.steps) ? job.steps : []
  if (!steps.length) return bad.concat('jobs.stats.steps is empty')
  if (!steps.some((s) => /^actions\/checkout@v\d+$/.test(s.uses || ''))) bad.push('no actions/checkout step')
  if (!steps.some((s) => /^actions\/setup-node@v\d+$/.test(s.uses || ''))) bad.push('no actions/setup-node step')
  const fetchStep = steps.find((s) => /node scripts\/fetch-stats\.mjs/.test(s.run || ''))
  if (!fetchStep) bad.push('no step runs node scripts/fetch-stats.mjs')
  else for (const k of SECRETS) if (!fetchStep.env || fetchStep.env[k] !== '${{ secrets.' + k + ' }}') bad.push(`step env ${k} must be \${{ secrets.${k} }}`)
  if (root && !existsSync(join(root, 'scripts/fetch-stats.mjs'))) bad.push('scripts/fetch-stats.mjs does not exist')
  for (const s of steps) if (!s.uses && !s.run) bad.push('a step has neither uses nor run: ' + (s.name || '?'))
  const commit = steps.find((s) => /git push/.test(s.run || ''))
  if (!commit || !/git add -- stats\.json/.test(commit.run)) bad.push('the commit step must add stats.json by path')
  const exprs = [...text.matchAll(/\$\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1])
  for (const e of exprs) if (!SECRETS.some((k) => e === 'secrets.' + k)) bad.push('unexpected expression ${{ ' + e + ' }}')
  if (/echo[^\n]*secrets\./.test(text)) bad.push('a step echoes a secret')
  return bad
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const file = resolve(process.argv[2] || join(root, '.github/workflows/stats.yml'))
  const bad = lintWorkflow(readFileSync(file, 'utf8'), root)
  console.log(bad.length ? bad.map((b) => 'FAIL ' + b).join('\n') : 'workflow ok: ' + file)
  process.exit(bad.length ? 1 : 0)
}
