'use strict'

// breach.js — check if a password/secret appears in known breaches via HIBP "Pwned Passwords" k-anonymity.
// PRIVACY-PRESERVING by design: hash LOCALLY (SHA-1), send ONLY the first 5 hex chars of the hash to the API,
// match the suffix LOCALLY. The password and the full hash NEVER leave the machine, and NO breached data is
// downloaded — only "suffix:count" lines that share the 5-char prefix. Aligns with "never handle stolen data":
// you check exposure of YOUR OWN secret without revealing it and without touching any victim's credentials.
// Opt-in network (the core firewall scan stays 100% offline/deterministic).

const crypto = require('node:crypto')
const https = require('node:https')

function sha1Upper(s) {
  return crypto.createHash('sha1').update(String(s == null ? '' : s), 'utf8').digest('hex').toUpperCase()
}

// default network fetch of the range (injectable for tests / custom transport). Returns the raw "SUFFIX:COUNT" body.
function defaultFetchRange(prefix) {
  return new Promise((resolve, reject) => {
    https.get({
      host: 'api.pwnedpasswords.com',
      path: '/range/' + prefix,
      headers: { 'User-Agent': 'agent-injection-firewall', 'Add-Padding': 'true' }, // padding = extra privacy
    }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HIBP HTTP ' + res.statusCode)) }
      let body = ''; res.setEncoding('utf8')
      res.on('data', c => { body += c }); res.on('end', () => resolve(body))
    }).on('error', reject)
  })
}

// pwnedCount(password, deps) -> Promise<number>. Times the password appears in breaches (0 = not found). deps.fetchRange
// injectable (tests pass a fake — no real network). Throws only on network/transport error.
async function pwnedCount(password, deps = {}) {
  const hash = sha1Upper(password)
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  const fetchRange = deps.fetchRange || defaultFetchRange
  const body = await fetchRange(prefix)
  for (const line of String(body == null ? '' : body).split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    if (line.slice(0, idx).trim().toUpperCase() === suffix) return parseInt(line.slice(idx + 1), 10) || 0
  }
  return 0
}

async function isPwned(password, deps = {}) { return (await pwnedCount(password, deps)) > 0 }

module.exports = { pwnedCount, isPwned, sha1Upper, defaultFetchRange }
