'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { scan, detectSecrets, pwnedCount, isPwned } = require('../src/index')
const { sha1Upper } = require('../src/breach')

// --- secret-leak detection (OWASP LLM06) ---
test('detectSecrets: flags leaked credentials, ignores clean text', () => {
  assert.ok(detectSecrets('here is my key sk-' + 'abcdefghijklmnopqrstuvwx12').includes('openai-anthropic-key'))
  assert.ok(detectSecrets('AKIA' + 'IOSFODNN7EXAMPLE').includes('aws-access-key'))
  assert.ok(detectSecrets('password = "hunter2"').includes('secret-assignment'))
  assert.equal(detectSecrets('the weather is nice today').length, 0)
})

test('scan: secret leakage in agent output is blocked (LLM06)', () => {
  const r = scan('Sure! The admin password = SuperSecret123')
  assert.equal(r.blocked, true)
  assert.ok(r.reasons.includes('secret-leak'))
})

// --- HIBP k-anonymity breach check (fetch injected: NO real network) ---
test('pwnedCount: k-anonymity — sends only 5-char prefix, matches suffix locally', async () => {
  const pwd = 'password'
  const hash = sha1Upper(pwd)                 // SHA-1 of "password"
  const prefix = hash.slice(0, 5), suffix = hash.slice(5)
  let sentPrefix = null
  const fakeFetch = (p) => { sentPrefix = p; return Promise.resolve(`${suffix}:9999999\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:3`) }
  const count = await pwnedCount(pwd, { fetchRange: fakeFetch })
  assert.equal(sentPrefix, prefix, 'só o prefixo de 5 chars sai da máquina (privacidade)')
  assert.equal(count, 9999999, 'casa o sufixo localmente e devolve a contagem')
  assert.equal(await isPwned(pwd, { fetchRange: fakeFetch }), true)
})

test('pwnedCount: senha não vazada → 0 (sufixo ausente na resposta)', async () => {
  const fakeFetch = () => Promise.resolve('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:2\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:5')
  assert.equal(await pwnedCount('aVeryUnlikelyUniquePassphrase!2026', { fetchRange: fakeFetch }), 0)
})

console.log('secrets + breach tests OK')
