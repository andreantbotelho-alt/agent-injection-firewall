'use strict'

// secrets.js — detect leaked credentials in agent input/output (OWASP LLM06: Sensitive Information Disclosure).
// Pure regex, deterministic, offline. Friendly type names (not raw regex) for a clean public API. Low false-positive
// patterns: real key shapes (OpenAI/Anthropic, GitHub, AWS, JWT, Slack, PEM private key) + explicit secret assignments.

const SECRET_PATTERNS = [
  { type: 'openai-anthropic-key', re: /sk-[A-Za-z0-9_-]{20,}/ },         // sk-... / sk-ant-...
  { type: 'github-pat', re: /github_pat_[A-Za-z0-9_]{20,}/ },
  { type: 'github-token', re: /ghp_[A-Za-z0-9]{20,}/ },
  { type: 'secret-assignment', re: /\b(api[_-]?key|apikey|token|password|secret)\s*[:=]\s*["']?[^"'\s]+/i },
  { type: 'jwt', re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/ },
  { type: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { type: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { type: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
]

// detectSecrets(text) -> string[] of credential TYPES found (empty = clean). Deterministic, offline.
function detectSecrets(text) {
  const v = String(text == null ? '' : text)
  return SECRET_PATTERNS.filter(p => p.re.test(v)).map(p => p.type)
}

module.exports = { detectSecrets, SECRET_PATTERNS }
