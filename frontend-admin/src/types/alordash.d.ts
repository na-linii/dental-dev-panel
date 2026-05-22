declare module '@alordash/parse-word-to-number' {
  /** Replaces number-words in text with digits. errorLimit=0 = exact match only. */
  export function parseString(text: string, errorLimit: number): string
}
