'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { weakPassword } = require('../src/index')

test('weakPassword: pega os óbvios (os exemplos do Andre)', () => {
  assert.equal(weakPassword('1212').weak, true)        // repetido + all-digits + curto
  assert.equal(weakPassword('andre123').weak, true)    // palavra+número
  assert.equal(weakPassword('1234').weak, true)        // sequencial
  assert.equal(weakPassword('aaaa').weak, true)        // repetido
  assert.equal(weakPassword('qwerty').weak, true)      // teclado
  assert.equal(weakPassword('password').weak, true)    // lista comum
  assert.equal(weakPassword('p4ssw0rd').weak, true)    // leet de comum
  assert.equal(weakPassword('senha123').weak, true)    // palavra+número (PT)
})

test('weakPassword: razões corretas', () => {
  assert.ok(weakPassword('1212').reasons.includes('repeated-pattern'))
  assert.ok(weakPassword('andre123').reasons.includes('word-plus-number'))
  assert.ok(weakPassword('1234').reasons.includes('sequential'))
})

test('weakPassword: senha forte passa (não é falso-positivo)', () => {
  assert.equal(weakPassword('Tr0ub4dor&3xplore!Qz').weak, false)
  assert.equal(weakPassword('correct-horse-battery-staple-92!').weak, false)
})

console.log('weak-password tests OK')
