'use strict'

// weak.js — detect OBVIOUS / guessable passwords (deterministic, zero-dependency, offline).
// Catches the cheap-to-guess cases: too short, sequential (1234), repeated pattern (1212 / aaaa),
// common passwords, keyboard walks (qwerty), word+number (andre123), and leet of those (p4ssw0rd).
// NOT a full entropy estimator like zxcvbn — it's the lightweight "is this obviously bad?" gate.
// For exhaustive scoring, swap in the `zxcvbn` npm package; this keeps the product dep-free.

const { foldLeetIntraWord } = require('./scan-normalize') // reuse: catch p4ssw0rd ~ password

const COMMON = new Set([
  'password', 'passwd', 'senha', '123456', '12345678', '123456789', '1234567', '12345', '1234',
  'qwerty', 'qwertyuiop', 'asdfgh', 'abc123', '111111', '000000', '123123', '654321', 'admin',
  'letmein', 'welcome', 'monkey', 'dragon', 'iloveyou', 'sunshine', 'princess', 'football',
  'qwerty123', 'password1', 'senha123', 'mudar123', 'changeme', 'master', 'superman', 'trustno1',
])
const KEYBOARD = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'qwerty', '1234567890', 'qazwsx', 'qwertz']

function isRepeatedPattern(s) {
  for (let p = 1; p <= Math.floor(s.length / 2); p++) {
    if (s.length % p === 0 && s.slice(0, p).repeat(s.length / p) === s) return true // 1212, aaaa, abab
  }
  return false
}
function isSequential(s) {
  if (s.length < 3) return false
  let asc = true, desc = true
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1)
    if (d !== 1) asc = false
    if (d !== -1) desc = false
  }
  return asc || desc // 1234, abcd, 4321
}

// weakPassword(pwd) -> { weak, reasons[] }. Deterministic, offline.
function weakPassword(pwd) {
  const raw = String(pwd == null ? '' : pwd)
  const low = raw.toLowerCase()
  const folded = foldLeetIntraWord(low) // p4ssw0rd -> passw0rd-ish, helps the common/word checks
  const reasons = []
  if (raw.length < 8) reasons.push('too-short')
  if (COMMON.has(low) || COMMON.has(folded)) reasons.push('common-password')
  if (isRepeatedPattern(raw)) reasons.push('repeated-pattern')   // 1212, aaaa
  if (isSequential(low)) reasons.push('sequential')              // 1234, abcd
  if (/^\d+$/.test(raw)) reasons.push('all-digits')              // 1212, 00000
  if (KEYBOARD.some(k => k.includes(low) && low.length >= 4)) reasons.push('keyboard-walk')
  if (/^[a-zà-ÿ]{2,}\d{1,6}$/i.test(low) || /^\d{1,6}[a-zà-ÿ]{2,}$/i.test(low)) reasons.push('word-plus-number') // andre123
  const distinct = new Set(raw).size
  if (raw.length >= 4 && distinct <= 2) reasons.push('low-variety') // 121212, abab
  return { weak: reasons.length > 0, reasons: [...new Set(reasons)] }
}

module.exports = { weakPassword, COMMON }
