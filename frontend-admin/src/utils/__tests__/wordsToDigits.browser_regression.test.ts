/**
 * Regression: PD-417 v2 wired `wordsToDigits` into AdminCallDetailPage. The
 * underlying library `@alordash/parse-word-to-number` loads its dictionary via
 * `fs.readdirSync(__dirname + '/expressions/')` in loader.js — fine under Node,
 * fatal in the Vite browser bundle (`ReferenceError: __dirname is not defined`).
 *
 * Because every transcript bubble calls `wordsToDigits`, the exception escapes
 * the React tree and `/calls/:sessionId` rendered as a blank white screen in
 * production (2026-05-25).
 *
 * The fix in wordsToDigits.ts is a defensive try/catch that returns the raw
 * text when the pipeline throws. This test pins that contract: even if the
 * library's loader or any future step blows up, the function must NEVER throw
 * — otherwise the whole admin call card page goes dark again.
 *
 * If you remove the try/catch, this test fails before the bug ships.
 */
import { describe, it, expect, vi } from 'vitest'

describe('wordsToDigits — never throws (browser-bundle safety net)', () => {
  it('returns the original text when parseString blows up', async () => {
    vi.resetModules()
    vi.doMock('@alordash/parse-word-to-number', () => ({
      parseString: () => {
        throw new ReferenceError('__dirname is not defined')
      },
    }))
    const { wordsToDigits } = await import('../wordsToDigits')
    const input = 'запись на шестнадцать ноль ноль к доктору Шевелюк'
    expect(() => wordsToDigits(input)).not.toThrow()
    expect(wordsToDigits(input)).toBe(input)
    vi.doUnmock('@alordash/parse-word-to-number')
  })

  it('survives parseString returning non-string garbage', async () => {
    vi.resetModules()
    vi.doMock('@alordash/parse-word-to-number', () => ({
      parseString: () => {
        // simulate later library version returning an object instead of string
        return { unexpected: 'shape' } as unknown as string
      },
    }))
    const { wordsToDigits } = await import('../wordsToDigits')
    // Either gracefully passes through or returns the raw text — never throws.
    expect(() => wordsToDigits('пять рублей')).not.toThrow()
    vi.doUnmock('@alordash/parse-word-to-number')
  })
})
