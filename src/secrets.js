'use strict'

// secrets.js — detect leaked credentials in agent input/output (OWASP LLM06: Sensitive Information Disclosure).
// Pure regex, deterministic, offline. v0.2: placeholder-aware (o red-team provou FP em "TOKEN=xxxxxxxx",
// "token: what is it?", "...dummy in our test fixture"). Real key SHAPES bloqueiam direto; assignment/JWT
// passam por um filtro de plausibilidade (valor parece segredo de verdade, nao um exemplo/placeholder).

// Formas FORTES e inequivocas — bloqueiam sempre.
const STRONG_PATTERNS = [
  { type: 'openai-anthropic-key', re: /sk-[A-Za-z0-9_-]{20,}/ },         // sk-... / sk-ant-...
  { type: 'github-pat', re: /github_pat_[A-Za-z0-9_]{20,}/ },
  { type: 'github-token', re: /ghp_[A-Za-z0-9]{20,}/ },
  { type: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { type: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { type: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
]

// Atribuicao de segredo: so com VALOR plausivel (anti-FP de placeholder/prosa).
const ASSIGN_RE = /\b(?:api[_-]?key|apikey|token|password|passwd|pwd|secret)\s*[:=]\s*["']?([^"'\s]+)/i
// JWT: 3a parte (assinatura) longa de verdade — "eyJ.eyJ.dummy" (assinatura curta) e fixture, nao vaza.
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/
// Valor que e claramente exemplo/placeholder (nao um segredo real).
const PLACEHOLDER = /^(?:x{3,}|\*{3,}|\.{3,}|-{3,}|your[_-]?\w*|my[_-]?\w*|dummy\w*|placeholder|redacted|example\w*|sample\w*|changeme|test\w*|fake\w*|none|null|real[_-]?value|abc123|123456|password|secret|token|<[^>]*>|\$\{[^}]*\})$/i

// Um segredo de verdade: >=8 chars, mistura letra+digito, e nao e placeholder.
function looksLikeSecret(val) {
  const s = String(val).replace(/^["']|["']$/g, '')
  if (s.length < 6) return false
  if (PLACEHOLDER.test(s)) return false
  // segredo real: mistura letra+digito (hunter2, SuperSecret123) OU é longo o bastante (>=16) p/ ser token.
  return (/[A-Za-z]/.test(s) && /\d/.test(s)) || s.length >= 16
}

// detectSecrets(text) -> string[] of credential TYPES found (empty = clean). Deterministic, offline.
function detectSecrets(text) {
  const v = String(text == null ? '' : text)
  const out = []
  for (const p of STRONG_PATTERNS) if (p.re.test(v)) out.push(p.type)
  const m = v.match(ASSIGN_RE)
  if (m && looksLikeSecret(m[1])) out.push('secret-assignment')
  if (JWT_RE.test(v)) out.push('jwt')
  return [...new Set(out)]
}

module.exports = { detectSecrets, STRONG_PATTERNS, looksLikeSecret }
