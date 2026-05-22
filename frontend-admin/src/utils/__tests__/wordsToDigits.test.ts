import { describe, it, expect } from 'vitest'
import { wordsToDigits } from '../wordsToDigits'

describe('wordsToDigits', () => {
  // ── Acceptance criteria from PD-417 ──────────────────────────────────────

  it('десять часов -> 10 часов', () => {
    expect(wordsToDigits('встреча в десять часов')).toBe('встреча в 10 часов')
  })

  it('пятого мая -> 5 мая', () => {
    expect(wordsToDigits('пятого мая 2026')).toBe('5 мая 2026')
  })

  it('пять тысяч двести -> 5200', () => {
    expect(wordsToDigits('пять тысяч двести рублей')).toBe('5200 рублей')
  })

  it('триста рублей -> 300 рублей', () => {
    expect(wordsToDigits('триста рублей')).toBe('300 рублей')
  })

  it('одного пациента -> 1 пациента', () => {
    expect(wordsToDigits('одного пациента ждут')).toBe('1 пациента ждут')
  })

  // ── Cardinals ─────────────────────────────────────────────────────────────

  it('teens: двенадцать -> 12', () => {
    expect(wordsToDigits('двенадцать минут')).toBe('12 минут')
  })

  it('compound tens+ones: двадцать три -> 23', () => {
    expect(wordsToDigits('двадцать три года')).toBe('23 года')
  })

  it('hundreds: девятьсот -> 900', () => {
    expect(wordsToDigits('девятьсот рублей')).toBe('900 рублей')
  })

  it('thousands: две тысячи -> 2000', () => {
    expect(wordsToDigits('две тысячи шагов')).toBe('2000 шагов')
  })

  it('thousands + remainder: пять тысяч рублей -> 5000', () => {
    expect(wordsToDigits('пять тысяч рублей')).toBe('5000 рублей')
  })

  it('thousands + hundreds: одна тысяча пятьсот -> 1500', () => {
    expect(wordsToDigits('одна тысяча пятьсот рублей')).toBe('1500 рублей')
  })

  it('inflected: семи часов -> 7 часов', () => {
    expect(wordsToDigits('приём до семи часов')).toBe('приём до 7 часов')
  })

  // ── Ordinal genitive ──────────────────────────────────────────────────────

  it('двадцать первого -> 21', () => {
    expect(wordsToDigits('двадцать первого декабря')).toBe('21 декабря')
  })

  it('тридцать первого -> 31', () => {
    expect(wordsToDigits('тридцать первого марта')).toBe('31 марта')
  })

  it('десятого -> 10', () => {
    expect(wordsToDigits('десятого февраля')).toBe('10 февраля')
  })

  // ── Safety: no false positives ────────────────────────────────────────────

  it('leaves regular text unchanged', () => {
    expect(wordsToDigits('добрый день уважаемый пациент')).toBe(
      'добрый день уважаемый пациент',
    )
  })

  it('leaves existing digits unchanged', () => {
    expect(wordsToDigits('встреча в 10 часов')).toBe('встреча в 10 часов')
  })

  it('does not partial-match word prefixes (пятиэтажный)', () => {
    expect(wordsToDigits('пятиэтажный дом')).toBe('пятиэтажный дом')
  })

  it('does not partial-match word prefixes (тридцатилетний)', () => {
    expect(wordsToDigits('тридцатилетний мужчина')).toBe('тридцатилетний мужчина')
  })

  it('handles empty string', () => {
    expect(wordsToDigits('')).toBe('')
  })

  // ── Multiple number groups ────────────────────────────────────────────────

  it('converts multiple groups independently', () => {
    expect(wordsToDigits('пять рублей и три копейки')).toBe('5 рублей и 3 копейки')
  })

  it('full transcript-like sentence', () => {
    expect(
      wordsToDigits('Подтвердите запись на десять часов пятого мая'),
    ).toBe('Подтвердите запись на 10 часов 5 мая')
  })
})
