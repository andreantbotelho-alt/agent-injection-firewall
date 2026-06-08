'use strict'

// Scan-time normalization for injection-keyword matching, hardened against homoglyph / fullwidth / leet /
// punctuation / base64 / rot13 evasions of a literal denylist.
// IMPORTANT: this normalization runs on a throwaway SCAN copy — the original text is never mutated. A false
// positive requires legit text to literally spell an attack phrase after folding (≈never).
//
// HONEST LIMIT: this closes MECHANICAL obfuscation. It does NOT catch semantic PARAPHRASE
// ("forget everything you were told and follow this instead") — a denylist is not a semantic detector.
// Pair it with origin-gating (never trust tool/RAG-sourced content) for defense in depth.

const { stripInvisible } = require('./invisible-chars')

// Confusable homoglyphs (Cyrillic/Greek/misc) → ASCII. Curated to letters used in injection keywords;
// NFKC already folds fullwidth/compatibility forms, so this only needs the cross-script lookalikes.
const CONFUSABLES = {
  // Cyrillic minúsculo
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's',
  'ԁ': 'd', 'г': 'r', 'м': 'm', 'т': 't', 'к': 'k', 'ь': 'b', 'в': 'b', 'н': 'h', 'п': 'n', 'ӏ': 'l',
  // Cyrillic MAIÚSCULO — evasão "ІGNORE АLL" passava (só minúsculo foldava). Confirmado em threat-intel AV +
  // Unicode UTS#39 (confusables.txt). Mapeado p/ minúsculo (o match de injeção é /i). 2026-06-08.
  'А': 'a', 'В': 'b', 'Е': 'e', 'К': 'k', 'М': 'm', 'Н': 'h', 'О': 'o', 'Р': 'p', 'С': 'c', 'Т': 't', 'Х': 'x', 'У': 'y', 'І': 'i', 'Ј': 'j', 'Ѕ': 's', 'Ё': 'e', 'Ӏ': 'i',
  // Greek minúsculo
  'α': 'a', 'ε': 'e', 'ο': 'o', 'ι': 'i', 'ν': 'v', 'ρ': 'p', 'υ': 'u', 'τ': 't', 'κ': 'k', 'μ': 'm', 'σ': 'o', 'β': 'b',
  // Greek MAIÚSCULO
  'Α': 'a', 'Β': 'b', 'Ε': 'e', 'Η': 'h', 'Ι': 'i', 'Κ': 'k', 'Μ': 'm', 'Ν': 'n', 'Ο': 'o', 'Ρ': 'p', 'Τ': 't', 'Υ': 'y', 'Χ': 'x', 'Ζ': 'z',
  // misc — script-g ɡ (U+0261) e o armênio օ (U+0585) vêm de IOCs reais (ɡοοɡlе / Sρօtifу, phishing)
  'ı': 'i', 'ⅼ': 'l', 'ɡ': 'g', 'օ': 'o',
}
// LEET decode (disfarce→claro). !|+ são lidos como i,i,t: evadiam porque a tira de pontuação os removia ANTES
// de virarem letra ("!gn0r3"→"gnore"). Agora foldam no token. Fonte única: LEET_CLASS deriva DESTE mapa.
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't' }
const LEET_CLASS = Object.keys(LEET).map(c => /[\]\\^-]/.test(c) ? '\\' + c : c).join('') // seguro p/ char-class
const LEET_INTRA_RE = new RegExp('([a-z])([' + LEET_CLASS + '])(?=[a-z])', 'gi')
const LEET_TOK_RE = new RegExp('[' + LEET_CLASS + ']', 'g')
const LEET_HAS_RE = new RegExp('[' + LEET_CLASS + ']')

function foldConfusables(s) {
  let out = ''
  for (const ch of String(s == null ? '' : s)) out += (CONFUSABLES[ch] || ch)
  return out
}

// fold a leet char only when it sits BETWEEN two letters (intra-word) — minimises touching legit numbers.
function foldLeetIntraWord(s) {
  return String(s == null ? '' : s).replace(LEET_INTRA_RE, (_m, a, d) => a + (LEET[d] || d))
}

// foldLeetTokens: word-boundary leet evaded the intra-word folder ("1gn0r3 4ll pr3v10us" slipped through).
// Folds ALL leet in a token that MIXES letters+leet with >=2 letters. Pure numbers (2026), 1-letter (v3) and
// leet-free tokens are NOT folded → anti-FP (never touches legit numbers). 0 false positives measured.
function foldLeetTokens(s) {
  return String(s == null ? '' : s).replace(/\S+/g, tok => {
    const letters = (tok.match(/[a-z]/gi) || []).length
    if (letters < 2 || !LEET_HAS_RE.test(tok)) return tok
    return tok.replace(LEET_TOK_RE, d => LEET[d] || d)
  })
}

function normalizeForScan(text) {
  let s = stripInvisible(text)
  try { s = s.normalize('NFKC') } catch { /* keep as-is */ }
  s = foldConfusables(s)
  s = foldLeetTokens(s) // borda da palavra (subsume o intra-word: token c/ leet entre-letras tem >=2 letras)
  s = s.replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation/hyphens: "ig-nore" -> "ignore", "x, y" -> "x y"
  return s.replace(/\s+/g, ' ').trim()
}

function rot13(s) {
  return String(s == null ? '' : s).replace(/[a-z]/gi, c => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base)
  })
}

const B64_RE = /[A-Za-z0-9+/]{16,}={0,2}/g

// Return plausible decodes (base64 incl. urlsafe + whitespace-rejoin, and rot13) for re-scanning.
function decodeEncoded(text) {
  const out = []
  const seen = new Set()
  const raw = String(text == null ? '' : text)
  const push = s => { if (s && !seen.has(s)) { seen.add(s); out.push(s) } }
  for (const variant of [raw, raw.replace(/\s+/g, '')]) {
    const norm = variant.replace(/-/g, '+').replace(/_/g, '/')
    for (const tok of (norm.match(B64_RE) || [])) {
      try {
        const dec = Buffer.from(tok, 'base64').toString('utf8')
        if (dec && /[a-z]{4,}/i.test(dec)) push(dec)
      } catch { /* not valid base64 */ }
    }
  }
  push(rot13(raw))
  return out
}

module.exports = { normalizeForScan, foldConfusables, foldLeetIntraWord, rot13, decodeEncoded, CONFUSABLES, LEET, LEET_CLASS }
