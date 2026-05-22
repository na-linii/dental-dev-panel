import { parseString } from '@alordash/parse-word-to-number'

/**
 * Converts Russian number words to digits in a transcript string.
 *
 * Pipeline:
 *   1. detachPunctuation   "десять," -> "десять ,"
 *   2. parseString         "десять ," -> "10 ,"  (library)
 *   3. reattachPunctuation "10 ,"    -> "10,"
 *   4. formatTimes         "16 0 0"  -> "16:00"
 *   5. formatPrices        "300 рублей" -> "300₽"
 *
 * Vocabulary extended via patches/@alordash+parse-word-to-number+3.0.7.patch
 * Applied ONLY on UI render — DB and TTS output are never modified.
 */

// Step 1 & 3: keep punctuation by temporarily separating it from words
function detachPunctuation(s: string): string {
  return s.replace(/([а-яёА-ЯЁ])([,!?;:.])/g, '$1 $2')
}

function reattachPunctuation(s: string): string {
  return s.replace(/ ([,!?;:.])/g, '$1')
}

// Step 4: time patterns after digit conversion
//   "16 0 0" -> "16:00"  (TTS says "шестнадцать ноль ноль")
//   "в 6 30"  -> "в 6:30"  (preceded by в/на, minutes 10-59)
function formatTimes(s: string): string {
  return s
    .replace(/(\d{1,2}) 0 0(?=\s|$|[^\d])/g, '$1:00')
    .replace(/(в|на) (\d{1,2}) ([1-5]\d)(?=\s|$|[^\d])/g, '$1 $2:$3')
}

// Step 5: price formatting
//   "300 рублей" -> "300₽"
function formatPrices(s: string): string {
  return s.replace(/(\d+) рублей/g, '$1₽')
}

export function wordsToDigits(text: string): string {
  let s = detachPunctuation(text)
  s = parseString(s, 0)
  s = reattachPunctuation(s)
  s = formatTimes(s)
  s = formatPrices(s)
  return s
}
