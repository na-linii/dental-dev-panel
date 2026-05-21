import { parseString } from '@alordash/parse-word-to-number'

/**
 * Converts Russian number words to digits in a string.
 *
 * Uses @alordash/parse-word-to-number with an extended RU.csv vocabulary
 * (see patches/@alordash+parse-word-to-number+3.0.7.patch for added forms).
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
  return parseString(text, 0)
}
