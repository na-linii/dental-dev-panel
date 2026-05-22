import { parseString } from '@alordash/parse-word-to-number'

/**
 * Converts Russian number words to digits in a transcript string.
 *
 * Pipeline:
 *   1. detachPunctuation   "десять,"   -> "десять ,"    (comma fix)
 *   2. preprotectTime      "ноль ноль" -> "нольноль"    (before library)
 *   3. parseString                                       (library)
 *   4. reattachPunctuation "10 ,"      -> "10,"
 *   5. formatTimes         "16 нольноль" -> "16:00"
 *   6. formatPrices        "300 рублей"  -> "300₽"      (explicit user request)
 *
 * Vocabulary extended via patches/@alordash+parse-word-to-number+3.0.7.patch
 * Applied ONLY on UI render — DB and TTS output are never modified.
 */

// ── Punctuation ─────────────────────────────────────────────────────────────
function detachPunctuation(s: string): string {
  return s.replace(/([а-яёА-ЯЁ])([,!?;:.])/g, '$1 $2')
}
function reattachPunctuation(s: string): string {
  return s.replace(/ ([,!?;:.])/g, '$1')
}

// ── Time protection ──────────────────────────────────────────────────────────
// Library collapses two consecutive «ноль» into one 0 token.
// Replace «ноль ноль» with a non-dictionary word BEFORE parseString;
// use a regex literal (not new RegExp) so \d stays as digit metachar.
function preprotectTime(s: string): string {
  return s.replace(/ноль ноль/gi, 'нольноль')
}

// ── Time formatting ──────────────────────────────────────────────────────────
function formatTimes(s: string): string {
  return s
    .replace(/(\d{1,2}) нольноль/g, '$1:00')     // "16 нольноль" -> "16:00"
    .replace(/нольноль/g, '00')                   // fallback
    .replace(/(\d{1,2}) 0 0(?=\s|$|[^\d])/g, '$1:00')  // "16 0 0" -> "16:00" (safety)
    .replace(/(в|на) (\d{1,2}) ([1-5]\d)(?=\s|$|[^\d])/g, '$1 $2:$3') // "в 6 30" -> "в 6:30"
    .replace(/(в|на) ([01]?\d|2[0-3])(?!:\d)(?=[,.]|$| и | а | или )/g, '$1 $2:00') // "в 9," / "в 9 и" -> "в 9:00"
}

// ── Price formatting ─────────────────────────────────────────────────────────
function formatPrices(s: string): string {
  return s.replace(/(\d+) рублей/g, '$1₽')
}

// ── Public API ───────────────────────────────────────────────────────────────
export function wordsToDigits(text: string): string {
  let s = detachPunctuation(text)
  s = preprotectTime(s)    // must be before parseString
  s = parseString(s, 0)
  s = reattachPunctuation(s)
  s = formatTimes(s)
  s = formatPrices(s)
  return s
}
