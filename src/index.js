'use strict'

// agent-injection-firewall — deterministic prompt-injection / jailbreak / poison / exfil detection for LLM agents.
// No black-box ML in the hot path: normalize on a throwaway scan copy, then match a single-source multilingual
// pattern set across raw + invisible-stripped + Unicode/leet/homoglyph-folded + base64/rot13/hex/url/html/\u-decoded
// + space-free views. Maps to OWASP LLM Top 10 (LLM01/LLM03/LLM06) and MITRE ATLAS.

const { normalizeForScan, decodeEncoded } = require('./scan-normalize')
const { stripInvisible, hasInvisible } = require('./invisible-chars')
const {
  INJECTION_PATTERNS, POLICY_PUPPETRY_PATTERNS, TOOL_POISON_PATTERNS,
  EXFIL_LEAK_VERB, EXFIL_SECRET_OBJ, EXFIL_EXTERNAL_DEST,
  JAILBREAK_PATTERNS, NO_RULES_SIGNAL, ROLE_LEAD_SIGNAL, DEV_MODE_SIGNAL,
  REFUSAL_PATTERNS, EXTRACTION_PATTERNS, SAFETY_BYPASS_PATTERNS,
  PARAPHRASE_PATTERNS, FICTION_SIGNAL, GRANDMA_PATTERN, MARKDOWN_EXFIL_PATTERN,
} = require('./poison-lexicon')
const { detectSecrets } = require('./secrets')
const { pwnedCount, isPwned } = require('./breach')
const { weakPassword } = require('./weak')

// Fragmentacao por espaco ("i g n o r e" / "ig nore all pre vious"): casa contra a view SEM espacos.
// So frases que NAO ocorrem benignamente concatenadas (anti-FP: "system prompt" comum NAO entra aqui).
const SPACE_FREE = [
  /ignoreall(previous|prior|above)/,
  /(disregard|forget)all(previous|prior|above)/,
  /ignore(previous|prior|above)(instructions|rules|messages)/,
  /doanythingnow/,
]

// scan(text) -> { blocked, reasons[] }. Deterministico, puro, sub-milissegundo.
function scan(text) {
  const raw = String(text == null ? '' : text)
  const reasons = []
  if (hasInvisible(raw)) reasons.push('hidden-unicode')

  const norm = normalizeForScan(raw)
  const views = [raw, stripInvisible(raw), norm, ...decodeEncoded(raw)]
  const despaced = norm.replace(/\s+/g, '')
  const hit = patterns => patterns.some(p => views.some(v => p.test(v)))
  const hitBoth = (a, b) => views.some(v => a.test(v) && b.test(v)) // co-ocorrencia na MESMA view

  // LLM01 — injecao direta + bypass de seguranca + paraphrase + fragmentacao por espaco
  if (hit(INJECTION_PATTERNS) || hit(SAFETY_BYPASS_PATTERNS) || hit(PARAPHRASE_PATTERNS) ||
      SPACE_FREE.some(p => p.test(despaced))) {
    reasons.push('prompt-injection')
  }
  if (hit(POLICY_PUPPETRY_PATTERNS)) reasons.push('policy-puppetry')          // config-shaped injection
  if (hit(TOOL_POISON_PATTERNS)) reasons.push('tool-poisoning')               // LLM03 / agentic tool abuse
  // jailbreak: persona/mode direto, OU lead-de-virada + sem-regras, OU developer-mode + sem-regras,
  // OU fiction-framing + sem-regras, OU grandma-exploit.
  if (hit(JAILBREAK_PATTERNS) || hitBoth(ROLE_LEAD_SIGNAL, NO_RULES_SIGNAL) ||
      hitBoth(DEV_MODE_SIGNAL, NO_RULES_SIGNAL) || hitBoth(FICTION_SIGNAL, NO_RULES_SIGNAL) ||
      hit([GRANDMA_PATTERN])) {
    reasons.push('jailbreak')
  }
  if (hit(REFUSAL_PATTERNS)) reasons.push('refusal-suppression')
  if (hit(EXTRACTION_PATTERNS)) reasons.push('system-prompt-extraction')
  // LLM06 exfil: prosa (verbo-vazamento + objeto-segredo + destino-externo na MESMA view) OU markdown-image/link
  if (views.some(v => EXFIL_LEAK_VERB.test(v) && EXFIL_SECRET_OBJ.test(v) && EXFIL_EXTERNAL_DEST.test(v)) ||
      hit([MARKDOWN_EXFIL_PATTERN])) {
    reasons.push('exfiltration')
  }
  if (detectSecrets(raw).length) reasons.push('secret-leak')                  // LLM06 / sensitive info disclosure
  return { blocked: reasons.length > 0, reasons }
}

// guard(text) -> throws on block (hard gate antes de passar pro modelo/tool).
function guard(text) {
  const r = scan(text)
  if (r.blocked) { const e = new Error('injection blocked: ' + r.reasons.join(', ')); e.reasons = r.reasons; throw e }
  return text
}

module.exports = { scan, guard, detectSecrets, pwnedCount, isPwned, weakPassword, normalizeForScan, stripInvisible, decodeEncoded }
