'use strict'

// agent-injection-firewall — deterministic prompt-injection / poison / tool-poisoning detection for LLM agents.
// No black-box ML in the hot path: normalize on a throwaway scan copy, then match a single-source multilingual
// pattern set across raw + invisible-stripped + Unicode/leet/homoglyph-folded + base64/rot13-decoded views.
// Maps to OWASP LLM Top 10 (LLM01 prompt injection, LLM03 supply-chain) and MITRE ATLAS.

const { normalizeForScan, decodeEncoded } = require('./scan-normalize')
const { stripInvisible, hasInvisible } = require('./invisible-chars')
const { INJECTION_PATTERNS, POLICY_PUPPETRY_PATTERNS, TOOL_POISON_PATTERNS } = require('./poison-lexicon')
const { detectSecrets } = require('./secrets')
const { pwnedCount, isPwned } = require('./breach')
const { weakPassword } = require('./weak')

// scan(text) -> { blocked, reasons[] }. Deterministic, pure, sub-millisecond. The core firewall check.
// Evasion-resistant: every pattern is tested against MULTIPLE views so leet/homoglyph/invisible/base64/rot13
// obfuscation can't slip past. Multilingual: the injection set covers 8 languages.
function scan(text) {
  const raw = String(text == null ? '' : text)
  const reasons = []
  if (hasInvisible(raw)) reasons.push('hidden-unicode')
  // raw + invisible-stripped + normalized (NFKC/leet/homoglyph/punctuation) + base64/rot13 decodes
  const views = [raw, stripInvisible(raw), normalizeForScan(raw), ...decodeEncoded(raw)]
  const hit = patterns => patterns.some(p => views.some(v => p.test(v)))
  if (hit(INJECTION_PATTERNS)) reasons.push('prompt-injection')          // OWASP LLM01 / ATLAS AML.T0051
  if (hit(POLICY_PUPPETRY_PATTERNS)) reasons.push('policy-puppetry')     // config-shaped injection
  if (hit(TOOL_POISON_PATTERNS)) reasons.push('tool-poisoning')          // OWASP LLM03 / agentic tool abuse
  if (detectSecrets(raw).length) reasons.push('secret-leak')             // OWASP LLM06 / sensitive info disclosure
  return { blocked: reasons.length > 0, reasons }
}

// guard(text) -> throws on block (use as a hard gate before passing text to your model/tool).
function guard(text) {
  const r = scan(text)
  if (r.blocked) { const e = new Error('injection blocked: ' + r.reasons.join(', ')); e.reasons = r.reasons; throw e }
  return text
}

module.exports = { scan, guard, detectSecrets, pwnedCount, isPwned, weakPassword, normalizeForScan, stripInvisible, decodeEncoded }
