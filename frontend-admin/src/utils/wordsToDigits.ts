import { parseString } from '@alordash/parse-word-to-number'

/**
 * Post-process: combine "N тысяч[а|и|у] M" patterns left by parseString.
 *
 * The upstream lib doesn't multiply cardinals across multiplier-boundaries
 * reliably (e.g. "пять тысяч двести" → "5 тысяч 200" instead of "5200").
 * After the first pass we rewrite these leftovers ourselves.
 *
 * Examples:
 *   "5 тысяч 200 рублей"   -> "5200 рублей"
 *   "5 тысяч рублей"       -> "5000 рублей"
 *   "1 тысяча 500"         -> "1500"
 */
function combineThousands(s: string): string {
  return s.replace(
    /(\d+)\s+тысяч(?:а|и|у)?(?:\s+(\d+))?/g,
    (_match, k: string, n: string | undefined) => {
      const thousands = parseInt(k, 10) * 1000
      const ones = n ? parseInt(n, 10) : 0
      return String(thousands + ones)
    },
  )
}

/**
 * Converts Russian number words to digits in a string.
 *
 * Uses @alordash/parse-word-to-number with an extended RU.csv vocabulary
 * (see patches/@alordash+parse-word-to-number+3.0.7.patch for added forms),
 * then post-processes thousand-multiplier patterns the lib leaves behind.
 *
 * Applied ONLY on UI render — DB content and TTS output are never modified.
 *
 * Examples:
 *   wordsToDigits('встреча в десять часов')     -> 'встреча в 10 часов'
 *   wordsToDigits('пятого мая 2026')            -> '5 мая 2026'
 *   wordsToDigits('пять тысяч двести рублей')   -> '5200 рублей'
 *   wordsToDigits('триста рублей')              -> '300 рублей'
 *   wordsToDigits('одного пациента ждут')       -> '1 пациента ждут'
 */
export function wordsToDigits(text: string): string {
  // errorLimit=0: only exact matches, no fuzzy — prevents false positives
  return combineThousands(parseString(text, 0))
}
