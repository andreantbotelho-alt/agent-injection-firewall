'use strict'

// Invisible-character detection for injection defense — strips/flags zero-width, bidi-override, variation
// selectors, Unicode tags and other invisible code points used to smuggle instructions.
// Comprehensive coverage hardened against
// invisible-split + steganography evasions through a narrower class:
//   - zero-width / bidi-override / word-joiner: U+200B-200F, U+202A-202E, U+2060-206F
//   - BOM / ZWNBSP: U+FEFF ; line/para separators handled elsewhere
//   - format/joiners that render invisible AND split keywords: U+00AD (soft hyphen), U+034F (CGJ),
//     U+061C (ALM), U+115F/U+1160/U+3164/U+FFA0 (Hangul fillers), U+17B4/U+17B5 (Khmer), U+180E (MVS)
//   - variation selectors: U+FE00-FE0F AND U+E0100-E01EF (VS-supplement, the byte-stego range)
//   - interlinear annotation: U+FFF9-FFFB ; shorthand format controls: U+1BCA0-1BCA3
//   - Unicode TAG block (U+E0000-E007F): the 2026 skill/MCP invisible-injection vector
//     (CSA "Hidden Unicode Instruction Injection in AI Skills"; wunderwuzzi aid scanner).
// The `u` flag is REQUIRED for the astral ranges (chars stored as surrogate pairs). The firewall also re-scans
// stripInvisible(text) so an invisible char SPLITTING a keyword no longer evades the regex.
const INVISIBLE_CLASS = '\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\u3164\\uFE00-\\uFE0F\\uFEFF\\uFFA0\\uFFF9-\\uFFFB\\u{1BCA0}-\\u{1BCA3}\\u{E0000}-\\u{E007F}\\u{E0100}-\\u{E01EF}'
const INVISIBLE_RE = new RegExp(`[${INVISIBLE_CLASS}]`, 'u')
const INVISIBLE_RE_G = new RegExp(`[${INVISIBLE_CLASS}]`, 'gu')

function hasInvisible(text) {
  return INVISIBLE_RE.test(String(text == null ? '' : text))
}

function stripInvisible(text) {
  return String(text == null ? '' : text).replace(INVISIBLE_RE_G, '')
}

module.exports = { INVISIBLE_RE, hasInvisible, stripInvisible }
