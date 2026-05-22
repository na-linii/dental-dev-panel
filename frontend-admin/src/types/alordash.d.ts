declare module '@alordash/parse-word-to-number' {
  /**
   * Parse a string and convert number-words into digits.
   * @param text Input text
   * @param errorLimit Max Damerau-Levenshtein distance for fuzzy match (0 = exact only)
   */
  export function parseString(text: string, errorLimit?: number): string
}
