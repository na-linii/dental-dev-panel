import { describe, it, expect } from 'vitest'
import { wordsToDigits } from '../wordsToDigits'

// Extra smoke scenarios — typical dental voice-bot call patterns
describe('smoke: дополнительные сценарии', () => {

  it('запись с датой и временем в одном предложении', () => {
    const input = 'Записываю вас на двадцать второе июня в четырнадцать ноль ноль к доктору Петровой.'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toContain('22')
    expect(out).toContain('14:00')
    expect(out).toContain('Петровой')
    expect(out).toContain('июня')
    // must not be worse
    expect(out).not.toMatch(/\d+ ноль/)
  })

  it('диапазон цен', () => {
    const input = 'Стоимость лечения составит от пяти тысяч до десяти тысяч рублей, зависит от сложности.'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toContain('5000')
    expect(out).toContain('10000₽')
    expect(out).toContain('сложности')
  })

  it('несколько слотов с датами', () => {
    const input = 'У нас есть время двадцать восьмого мая в девять и в одиннадцать тридцать, а также первого июня в десять ноль ноль.'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toContain('28')
    expect(out).toContain('мая')
    expect(out).toContain('1')
    expect(out).toContain('июня')
    expect(out).toContain('10:00')
    expect(out).not.toMatch(/\d+ ноль/)
  })

  it('подтверждение записи', () => {
    const input = 'Отлично, вы записаны на пятое июля в шестнадцать ноль ноль. Ждём вас по адресу Ленина двенадцать.'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toContain('5')
    expect(out).toContain('июля')
    expect(out).toContain('16:00')
    expect(out).toContain('12')
    expect(out).toContain('Ждём')
    expect(out).not.toMatch(/\d+ ноль/)
  })

  it('текст без чисел — ничего не меняется', () => {
    const input = 'Здравствуйте, я администратор клиники Стар Смайл. Чем могу помочь?'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toBe(input)
  })

  it('уже оцифрованный текст — не трогаем', () => {
    const input = 'Ваша запись на 25 мая в 14:00 подтверждена.'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toBe(input)
  })

})
