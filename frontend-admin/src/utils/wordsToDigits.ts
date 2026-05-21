/**
 * wordsToDigits — converts Russian number words to digits in a string.
 *
 * Applied ONLY on UI render (transcript display).
 * DB content and TTS voice output are never modified.
 *
 * Examples:
 *   wordsToDigits('встреча в десять часов')     -> 'встреча в 10 часов'
 *   wordsToDigits('пятого мая 2026')            -> '5 мая 2026'
 *   wordsToDigits('пять тысяч двести рублей')   -> '5200 рублей'
 *   wordsToDigits('триста рублей')              -> '300 рублей'
 *   wordsToDigits('одного пациента ждут')       -> '1 пациента ждут'
 */

// JS \b does not handle Cyrillic — use explicit lookbehind/lookahead guards.
const CYR_START = '(?<![а-яёА-ЯЁ])'
const CYR_END = '(?![а-яёА-ЯЁ])'

// ── Phase 1: Ordinal genitive (пятого мая -> 5 мая) ──────────────────────────
// Multi-word ordinals MUST come before their constituent single words so that
// "двадцать первого" is replaced as a unit before "двадцать" or "первого".
const ORDINAL_ENTRIES: [string, string][] = [
  ['тридцать первого', '31'],
  ['тридцатого', '30'],
  ['двадцать девятого', '29'],
  ['двадцать восьмого', '28'],
  ['двадцать седьмого', '27'],
  ['двадцать шестого', '26'],
  ['двадцать пятого', '25'],
  ['двадцать четвёртого', '24'],
  ['двадцать четвертого', '24'],
  ['двадцать третьего', '23'],
  ['двадцать второго', '22'],
  ['двадцать первого', '21'],
  ['двадцатого', '20'],
  ['девятнадцатого', '19'],
  ['восемнадцатого', '18'],
  ['семнадцатого', '17'],
  ['шестнадцатого', '16'],
  ['пятнадцатого', '15'],
  ['четырнадцатого', '14'],
  ['тринадцатого', '13'],
  ['двенадцатого', '12'],
  ['одиннадцатого', '11'],
  ['десятого', '10'],
  ['девятого', '9'],
  ['восьмого', '8'],
  ['седьмого', '7'],
  ['шестого', '6'],
  ['пятого', '5'],
  ['четвёртого', '4'],
  ['четвертого', '4'],
  ['третьего', '3'],
  ['второго', '2'],
  ['первого', '1'],
]

const ORDINAL_PAIRS: [RegExp, string][] = ORDINAL_ENTRIES.map(([word, digit]) => [
  new RegExp(CYR_START + word + CYR_END, 'gi'),
  digit,
])

// ── Phase 2: Cardinal number sequences ───────────────────────────────────────

const CARDINALS: Record<string, number> = {
  ноль: 0, нуль: 0,
  один: 1, одна: 1, одного: 1, одной: 1, одну: 1, одним: 1, одному: 1,
  два: 2, две: 2, двух: 2, двум: 2, двумя: 2,
  три: 3, трёх: 3, трех: 3, трём: 3, трем: 3, тремя: 3,
  четыре: 4, четырёх: 4, четырех: 4, четырём: 4, четырем: 4,
  пять: 5, пяти: 5, пятью: 5,
  шесть: 6, шести: 6, шестью: 6,
  семь: 7, семи: 7, семью: 7,
  восемь: 8, восьми: 8, восемью: 8,
  девять: 9, девяти: 9, девятью: 9,
  десять: 10, десяти: 10, десятью: 10,
  одиннадцать: 11, одиннадцати: 11,
  двенадцать: 12, двенадцати: 12,
  тринадцать: 13, тринадцати: 13,
  четырнадцать: 14, четырнадцати: 14,
  пятнадцать: 15, пятнадцати: 15,
  шестнадцать: 16, шестнадцати: 16,
  семнадцать: 17, семнадцати: 17,
  восемнадцать: 18, восемнадцати: 18,
  девятнадцать: 19, девятнадцати: 19,
  двадцать: 20, двадцати: 20,
  тридцать: 30, тридцати: 30,
  сорок: 40, сорока: 40,
  пятьдесят: 50, пятидесяти: 50,
  шестьдесят: 60, шестидесяти: 60,
  семьдесят: 70, семидесяти: 70,
  восемьдесят: 80, восьмидесяти: 80,
  девяносто: 90, девяноста: 90,
  сто: 100, ста: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
}

const MULTIPLIERS: Record<string, number> = {
  тысяча: 1000, тысячи: 1000, тысяч: 1000, тысячу: 1000,
  миллион: 1000000, миллиона: 1000000, миллионов: 1000000,
}

// Sort longest-first so "пятьдесят" is tried before "пять" in the alternation.
const sortedWordKeys = [...Object.keys(CARDINALS), ...Object.keys(MULTIPLIERS)].sort(
  (a, b) => b.length - a.length,
)
const wordAlt = sortedWordKeys.join('|')

// Use explicit space/tab class instead of \s to avoid JS string-escape ambiguity.
const SEQUENCE_RE = new RegExp(
  CYR_START + '((?:' + wordAlt + ')(?:[ \t]+(?:' + wordAlt + '))*)' + CYR_END,
  'gi',
)

function parseSequence(seq: string): number {
  const words = seq.trim().toLowerCase().split(/[ \t]+/)
  let total = 0
  let chunk = 0
  for (const word of words) {
    if (word in MULTIPLIERS) {
      total += (chunk === 0 ? 1 : chunk) * MULTIPLIERS[word]
      chunk = 0
    } else if (word in CARDINALS) {
      chunk += CARDINALS[word]
    }
  }
  return total + chunk
}

/**
 * Converts Russian number words in text to digit representation.
 * Safe to call on any string — non-number content is returned unchanged.
 */
export function wordsToDigits(text: string): string {
  let result = text

  // Phase 1 — ordinal genitive forms (dates: "пятого мая" -> "5 мая")
  for (const [re, digit] of ORDINAL_PAIRS) {
    result = result.replace(re, digit)
  }

  // Phase 2 — cardinal sequences ("пять тысяч двести" -> "5200")
  result = result.replace(SEQUENCE_RE, (match) => String(parseSequence(match)))

  return result
}
