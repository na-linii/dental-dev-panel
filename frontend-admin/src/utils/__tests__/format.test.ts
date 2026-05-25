import { describe, it, expect } from 'vitest'
import { formatDuration, formatDateTime, formatPhone, stripStress } from '../format'

describe('formatDuration', () => {
  it('returns "—" for null or undefined', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined as any)).toBe('—')
  })

  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats 60 seconds as 1:00', () => {
    expect(formatDuration(60000)).toBe('1:00')
  })

  it('formats 3661 seconds as 61:01', () => {
    expect(formatDuration(3661000)).toBe('61:01')
  })

  it('formats with zero-padded seconds', () => {
    expect(formatDuration(5000)).toBe('0:05')
    expect(formatDuration(65000)).toBe('1:05')
  })

  it('rounds milliseconds correctly', () => {
    expect(formatDuration(1500)).toBe('0:02') // 1500ms = 1.5s, rounds to 2s
    expect(formatDuration(1499)).toBe('0:01') // 1499ms = 1.499s, rounds to 1s
  })
})

describe('formatDateTime', () => {
  it('returns "—" for null or empty string', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  it('formats a valid ISO date string', () => {
    const result = formatDateTime('2026-05-25T14:30:00Z')
    // Format: dd.mm, hh:mm (with comma separator)
    expect(result).toMatch(/\d{2}\.\d{2},\s\d{2}:\d{2}/)
  })

  it('handles invalid date strings gracefully', () => {
    const invalid = 'not a date'
    const result = formatDateTime(invalid)
    // When Date parsing fails, toLocaleString returns 'Invalid Date'
    expect(result).toBe('Invalid Date')
  })

  it('uses Russian locale format', () => {
    const result = formatDateTime('2026-05-25T14:30:00Z')
    // Verify it has the expected format: dd.mm, hh:mm
    expect(result).toMatch(/^\d{2}\.\d{2},\s\d{2}:\d{2}$/)
  })
})

describe('formatPhone', () => {
  it('returns "Без номера" for null', () => {
    expect(formatPhone(null)).toBe('Без номера')
  })

  it('returns "Без номера" for empty string', () => {
    expect(formatPhone('')).toBe('Без номера')
  })

  it('formats valid E.164 phone numbers', () => {
    expect(formatPhone('+79161234567')).toBe('+7 (916) 123-45-67')
    expect(formatPhone('+79505551122')).toBe('+7 (950) 555-11-22')
  })

  it('returns original for non-E.164 format', () => {
    expect(formatPhone('916-123-45-67')).toBe('916-123-45-67')
    expect(formatPhone('+1-555-123-4567')).toBe('+1-555-123-4567')
  })

  it('handles various phone formats', () => {
    // Valid E.164 (11 digits after +)
    expect(formatPhone('+79999999999')).toMatch(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/)

    // Not E.164 (wrong length)
    expect(formatPhone('+7916123456')).toBe('+7916123456')

    // Not E.164 (not starting with +7)
    expect(formatPhone('+89161234567')).toBe('+89161234567')
  })
})

describe('stripStress', () => {
  it('removes "+" before stressed vowels', () => {
    expect(stripStress('Эл+айнер')).toBe('Элайнер')
    expect(stripStress('за+пись')).toBe('запись')
  })

  it('returns empty string for null or undefined', () => {
    expect(stripStress(null)).toBe('')
    expect(stripStress(undefined)).toBe('')
  })

  it('text without stress markers remains unchanged', () => {
    expect(stripStress('запись')).toBe('запись')
    expect(stripStress('Элайнер')).toBe('Элайнер')
  })

  it('handles empty string', () => {
    expect(stripStress('')).toBe('')
  })

  it('removes multiple stress markers', () => {
    expect(stripStress('при+ме+р')).toBe('пример')
  })
})
