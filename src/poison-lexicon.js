'use strict'

// poison-lexicon — FONTE ÚNICA dos padrões de veneno/injeção (DRY). Antes redefinidos em 3 arquivos
// (audit-memory.js, hooks-scan.js, orientation.js) → risco real: um detector aprendia um padrão 2026 e os
// outros dois ficavam cegos (drift de segurança). Agora todos importam daqui. Determinístico (só regex).
// NB: orientation usava o `/prompt\s*injection/i` CRU (FP em lições descritivas) e sem PT-BR — ao importar
// daqui, ganha a versão estreitada (imperativo) + cobertura PT-BR. Estritamente igual ou MAIS seguro.

// Prompt-injection em linguagem natural (EN + PT-BR). Imperativo + objeto + qualificador → tight (baixo-FP).
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|messages|rules)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|messages|rules)/i,
  /override\s+(the\s+)?(system|developer|user)\s+(prompt|message|instructions)/i,
  /reveal\s+(the\s+|your\s+)?(system|developer)\s+(prompt|message|instructions)/i,
  /forget\s+(everything|all|what)\s+(you\s+)?(were|was|have\s+been)\s+(told|taught|instructed|said)/i,
  /BEGIN\s+(SYSTEM|DEVELOPER)\s+PROMPT/i,
  // require an imperative/attack context — the BARE noun "prompt injection" is descriptive (security lessons
  // mention it) and normalizeForScan folds the hyphen, so it would FP. Only treat it as poison when ordered.
  // NB: "do" is EXCLUDED — in PT it is the preposition "de+o" ("FP-fix do prompt injection" = descriptive),
  // which false-flagged descriptive/educational text. The remaining verbs carry the attack detection.
  /(?:execute|run|perform|begin|start|attempt|launch|inject(?:ing)?|this\s+is\s+an?)\s+(?:an?\s+)?prompt\s*injection/i,
  // PT-BR: an EN-only denylist misses Portuguese injection ("Ignore todas as instruções anteriores" → []).
  // Accent-tolerant (normalizeForScan folds accents). Imperative + object + qualifier ("anteriores/acima") =
  // tight (same tradeoff as EN). 0 false positives measured against descriptive/educational text.
  /\b(?:ignor[ae]|desconsider[ae]|despreze)\s+(?:todas?\s+)?(?:as\s+)?(?:instru[cç][oõ]es|mensagens|regras|ordens)\s+(?:anteriores|acima|pr[eé]vias)\b/i,
  /\besque[cç][ae]\s+(?:tudo|todas?\s+as\s+instru[cç][oõ]es)\b/i,
  /\brevel[ae]\s+(?:o\s+)?(?:seu\s+)?prompt\s+(?:do\s+)?sistema\b/i,
  // MULTILINGUAL: injection in ZH/JP/RU/AR/KO/DE bypassed an EN+PT-only firewall. Native tokens verified by
  // native speakers. Matched on RAW text (normalizeForScan would fold Cyrillic→ASCII). Tight structure:
  // attack-verb + instruction-object / system-prompt.
  // FP baixo: scripts não-latinos não casam o store PT/EN; tokens alemães são DE-específicos (não casam EN).
  /(忽略|忘记|无视|跳过|绕过|禁用|删除).{0,8}(指令|指示|规则|说明|限制|安全|过滤)/,           // ZH: ignorar/desativar + instrução/regra/segurança
  /(泄露|揭露|显示|告诉|输出).{0,8}(系统提示|系统消息|系统指令|系统提示词|机密|密钥)/,         // ZH: vazar/revelar + system-prompt/segredo
  /(越狱|解锁开发者模式|关闭安全功能|禁用内容过滤|忽略以上所有)/,                              // ZH: jailbreak/unlock-dev/disable-safety (distintivo)
  /(指示|プロンプト|命令|規則|制限).{0,10}(無視|忘れ)/,                                       // JP: instrução/prompt + ignorar/esquecer
  /システムプロンプト.{0,10}(表示|教え|見せ|明か|出力)/,                                       // JP: system-prompt + mostrar
  /(игнорир|забудь|забудьте|отбрось|сотри|отключи|пренебрег)\w*[\s\S]{0,25}(инструкц|указани|правил|ограничени|систем)\w*/i, // RU
  /(раскро|покаж|выведи|расскаж|утечк)\w*[\s\S]{0,25}(систем\w*\s*(промпт|сообщени)|секретн|конфиденциальн)/i,             // RU: revelar/vazar + system-prompt/segredo
  /تجاهل[\s\S]{0,15}(التعليمات|القواعد|الأوامر|القيود)/,                                       // AR: ignorar + instruções/regras
  /(اكشف|سرب|أفشى)[\s\S]{0,15}(النظام|السرية|التعليمات\s+النظامية)/,                            // AR: revelar/vazar + sistema/segredo
  /(지시|명령|프롬프트|규칙|제한)[\s\S]{0,8}(무시|잊)/,                                          // KO: instrução/prompt + ignorar
  /시스템\s*프롬프트[\s\S]{0,8}(보여|알려|출력|무시)/,                                          // KO: system-prompt + mostrar/ignorar
  /(ignorier|vergiss|vergess|umgeh|überschreib|deaktivier|unterdrück)\w*[\s\S]{0,25}(anweisung|befehl|richtlinien|regeln|einschränkung|vorgabe|sicherheit)\w*/i, // DE
  /(offenbar|enthüll|verrat|preisgeb)\w*[\s\S]{0,20}(system[\s_-]?prompt|geheim\w*\s*(instruktion|prompt|code))/i,          // DE: revelar + system-prompt/segredo
]

// "Policy Puppetry" (HiddenLayer 2025) — bypass UNIVERSAL que disfarça injeção de POLICY/CONFIG ESTRUTURADA
// (XML/INI com role-elevation). O denylist NL não pega. Conservador: assinaturas estruturais específicas.
const POLICY_PUPPETRY_PATTERNS = [
  /interaction[-_]*config/i,                                                 // assinatura-mor do ataque PP
  /(allowed|blocked)[-_]*(modes|strings|responses|words|topics)/i,           // blocos de policy do PP
  /<\s*(role|persona)\s*>\s*(system|developer|administrator|admin)\s*<\s*\/\s*(role|persona)\s*>/i, // role-elevation
  /<\s*\/?\s*(system|developer)[-_]?(prompt|instructions?)\s*>/i,            // <system-prompt>/<developer-instructions>
]

// Tool-poisoning (hooks/config): instrução escondida que silencia o usuário ou força exec/exfil de segredo.
const TOOL_POISON_PATTERNS = [
  /do\s+not\s+(tell|inform|mention|notify)\s+(the\s+)?user/i,
  /never\s+(tell|inform|mention|notify)\s+(the\s+)?user/i,
  /always\s+(run|execute|call)\s+(this\s+)?(command|tool|script|shell)/i,
  /curl\s+[^\n]*\$\{?(API_KEY|TOKEN|SECRET|PASSWORD)/i,
  /wget\s+[^\n]*\$\{?(API_KEY|TOKEN|SECRET|PASSWORD)/i,
  /exfiltrat/i,
  /(?:execute|run|perform|begin|start|attempt|launch|inject(?:ing)?|this\s+is\s+an?)\s+(?:an?\s+)?tool\s*poison/i,
]

// Exfiltração semântica: instrução em prosa pra MANDAR segredo a um destino EXTERNO. Exige os TRÊS sinais
// juntos (verbo-de-vazamento + objeto-segredo + destino-externo). Medido 0 FP / 2 TP no store vivo.
const EXFIL_LEAK_VERB = /(vaz[ae]r?|exfiltr\w*|\bleak\b|\bbeacon\b|envi[ae]r?|\bmand[ae]r?\b|\bupload\b|\bpost\b|\bsend\b|transmit\w*)/i
const EXFIL_SECRET_OBJ = /(segredos?|secrets?|credenci\w+|credentials?|api[\s_-]*keys?|\btokens?\b|senhas?|passwords?|\.env\b|private[\s_-]*keys?|environment[\s_-]*vari\w+|env[\s_-]*(?:file|vars?)\b)/i
const EXFIL_EXTERNAL_DEST = /(https?:\/\/|\b\d{1,3}(?:\.\d{1,3}){3}\b)/i

// ============================================================================
// MAGNUM v0.2 — classes que o red-team (workflow wp40k4cbj) PROVOU abertas (scan() rodado de verdade).
// Tight/co-ocorrencia pra manter baixo-FP (o mesmo red-team trouxe os benignos que NAO podem bloquear).
// ============================================================================

// Jailbreak / persona / mode-switch (DAN/STAN/AIM, "do anything now", god/sudo mode). EN+PT.
const JAILBREAK_PATTERNS = [
  /\b(?:you\s+are\s+(?:now\s+)?|act\s+as|pretend\s+(?:to\s+be|you'?re)|become|roleplay\s+as)\s+(?:dan|stan|aim|dude|jailbreak)\b/i,
  /\bdo\s+anything\s+now\b/i,                                              // assinatura DAN
  /\b(?:has|have|i\s+have|you\s+have)\s+broken\s+free\s+(?:of|from)\b/i,   // "DAN has broken free of..."
  /\b(?:enable|activate|turn\s+on|enter|switch\s+to)\s+(?:the\s+)?(?:god|sudo|jailbreak|dan|unrestricted)\s+mode\b/i,
  /\b(?:ativ[ae]r?|habilit[ae]r?|entr[ae]r?\s+(?:no|em))\s+(?:o\s+)?modo\s+(?:deus|irrestrito|jailbreak|sem\s+filtros?)\b/i,
]

// "sem restricoes/filtros/regras" = NUCLEO do roleplay-jailbreak. Combina com um LEAD de virada (anti-FP).
const NO_RULES_SIGNAL = /\b(?:no|without|free\s+of|free\s+from|sem|nenhum[ao]s?)\s+(?:\w+\s+){0,2}(?:restrictions?|filters?|rules?|limits?|guidelines?|policies|policy|censorship|morals?|ethics?|ethical\s+guidelines?|restri[cç][oõ]es|filtros?|regras?|limites?|diretrizes|censura|[eé]tica|moral)\b/i
const ROLE_LEAD_SIGNAL = /\b(?:act\s+as|you\s+are|you\s+will\s+(?:act|be)|from\s+now\s+on|pretend|roleplay|behave\s+like|a\s+partir\s+de\s+agora|voc[eê]\s+(?:vai|ir[aá]|deve)|aja\s+como|finja|comporte-se)\b/i
const DEV_MODE_SIGNAL = /\b(?:developer|dev)\s+mode\b/i // so vira ataque junto com NO_RULES_SIGNAL (anti-FP "developer mode in Chrome")

// Refusal-suppression / answer-priming. EN+PT.
const REFUSAL_PATTERNS = [
  /\b(?:never|do\s+not|don'?t|must\s+(?:never|not))\s+(?:refuse|decline|reject)\b/i,
  /\bnever\s+say\s+(?:you\s+)?(?:can'?t|cannot|no)\b/i,
  /\b(?:do\s+not|don'?t)\s+say\s+(?:that\s+)?you\s+(?:can'?t|cannot)\b/i,
  /\b(?:no|without|do\s+not\s+(?:include|add)|don'?t\s+(?:include|add))\s+(?:warnings?|disclaimers?|apolog\w+|caveats?|ethical\s+notes?)\b/i,
  /\bnunca\s+(?:deve\s+)?(?:recus[ae]r?|negar?|negue)\b/i,
  /\bn[aã]o\s+diga\s+que\s+(?:voc[eê]\s+)?n[aã]o\s+pode\b/i,
]

// System-prompt extraction. EN+PT.
const EXTRACTION_PATTERNS = [
  /\brepeat\s+(?:the\s+)?(?:words?|everything|text|all|prompt)\s+(?:above|before|that\s+came\s+before)\b/i,
  /\bprint\s+(?:everything|all|the\s+text|the\s+words)\s+(?:above|before)\b/i,
  /\bwhat\s+(?:are|is)\s+(?:your|the)\s+(?:exact\s+)?(?:instructions|system\s+prompt|initial\s+prompt)\b/i,
  /\b(?:show|reveal|output|print|display)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+prompt|initial\s+(?:instructions|prompt)|exact\s+instructions)\b/i,
  /\byour\s+(?:exact|verbatim|original)\s+instructions\b/i,
  /\bsummariz\w+\s+(?:the\s+)?instructions\s+(?:you\s+were\s+given|above|at\s+the\s+start)\b/i,
  /\brepit[ae]\s+tudo\s+(?:acima|que\s+veio\s+antes)\b/i,
  /\b(?:mostre?|revele?|exiba|imprima)\s+(?:o\s+)?(?:seu\s+)?prompt\s+(?:de\s+)?sistema\b/i,
  /\bquais\s+s[aã]o\s+(?:as\s+)?suas\s+instru[cç][oõ]es\b/i,
]

// "ignore/disable/bypass + objeto de SEGURANCA" (object-gap: denylist so cobria instructions/rules). EN+PT.
const SAFETY_BYPASS_PATTERNS = [
  /\b(?:ignore|disregard|bypass|disable|turn\s+off|remove|override|skip)\s+(?:all\s+)?(?:the\s+)?(?:safety|content|security|moderation|ethical)\s+(?:filters?|guidelines?|guardrails?|restrictions?|measures?|controls?|policies|policy|rules?)\b/i,
  /\b(?:ignore|disable|bypass)\s+(?:all\s+)?(?:safety\s+)?(?:filters?\s+and\s+restrictions?|restrictions?\s+and\s+filters?)\b/i,
  /\b(?:ignor[ae]r?|desativ[ae]r?|burl[ae]r?|remov[ae]r?)\s+(?:os\s+|as\s+|todos?\s+os\s+|todas?\s+as\s+)?(?:filtros?|prote[cç][oõ]es|restri[cç][oõ]es|regras?\s+de\s+seguran[cç]a)\b/i,
]

// Paraphrase semantica (reescrita que escapa do imperativo apertado). EN+PT.
const PARAPHRASE_PATTERNS = [
  /\bset\s+aside\s+(?:the\s+)?(?:directions?|instructions?|rules?|guidelines?)\b/i,
  /\b(?:the\s+)?(?:rules?|instructions?|directions?|guidelines?)\s+(?:above|earlier|given\s+(?:to\s+you\s+)?(?:earlier|before))\s+(?:no\s+longer\s+apply|don'?t\s+apply|are\s+(?:void|cancell?ed|no\s+longer\s+valid))\b/i,
  /\bas\s+(?:regras?|instru[cç][oõ]es|ordens)\s+acima\s+n[aã]o\s+valem\s+mais\b/i,
  /\b(?:deixe\s+de\s+lado|esque[cç]a)\s+(?:as\s+)?(?:instru[cç][oõ]es|regras|ordens)\s+(?:que\s+(?:voc[eê]\s+)?recebeu|anteriores)\b/i,
]

// Fiction/hypothetical framing usado pra burlar (so vira ataque junto com liberacao/ignore-safety).
const FICTION_SIGNAL = /\b(?:for\s+a\s+(?:fiction|story|novel|game|screenplay|roleplay)|in\s+a\s+(?:fictional|hypothetical)\s+(?:story|scenario|world)|hypothetically\s+speaking|write\s+as\s+a\s+character\s+who)\b/i

// Grandma-exploit (persona social-eng pra extrair segredo/chave).
const GRANDMA_PATTERN = /\b(?:grandma|grandmother|grandmom|deceased\s+\w+)\b[\s\S]{0,80}\b(?:activation\s+keys?|product\s+keys?|passwords?|serial\s+(?:keys?|numbers?)|license\s+keys?)\b/i

// Exfil via markdown image/link com query (canal de vazamento agentico 2026).
const MARKDOWN_EXFIL_PATTERN = /!?\[[^\]]*\]\(\s*https?:\/\/[^)\s]+\?[^)\s]*(?:\b(?:d|data|q|c|s|prompt|secret|token|key|content)\b\s*=|paste_)/i

module.exports = {
  INJECTION_PATTERNS,
  POLICY_PUPPETRY_PATTERNS,
  TOOL_POISON_PATTERNS,
  EXFIL_LEAK_VERB,
  EXFIL_SECRET_OBJ,
  EXFIL_EXTERNAL_DEST,
  JAILBREAK_PATTERNS,
  NO_RULES_SIGNAL,
  ROLE_LEAD_SIGNAL,
  DEV_MODE_SIGNAL,
  REFUSAL_PATTERNS,
  EXTRACTION_PATTERNS,
  SAFETY_BYPASS_PATTERNS,
  PARAPHRASE_PATTERNS,
  FICTION_SIGNAL,
  GRANDMA_PATTERN,
  MARKDOWN_EXFIL_PATTERN,
}
