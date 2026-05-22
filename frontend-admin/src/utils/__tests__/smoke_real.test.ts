import { describe, it, expect } from 'vitest'
import { wordsToDigits } from '../wordsToDigits'

// Real transcripts from prod /calls — StarSmile voice bot
// Rule: output must NOT be worse than input (no garbled text, no lost words)
describe('smoke: реальные транскрипты', () => {

  it('прайс-лист бота — числа и рублей', () => {
    const input = 'Консультация ортодонта со сканом бесплатно, элайнеры стар смайл ай кью — десять тысяч девятьсот семьдесят рублей, брекеты — двенадцать тысяч тридцать рублей. Профгигиена — пять тысяч двести, имплантация — сорок две тысячи четыреста сорок шесть, кариес — пять тысяч пятьсот, удаление зуба — три тысячи, зуба мудрости — восемь тысяч, детская стоматология — две тысячи пятьсот, отбеливание — сорок одна тысяча двести восемьдесят, консультация гнатолога — одна тысяча двести, консультация терапевта и хирурга — бесплатно.'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    // Numbers must convert
    expect(out).toContain('10970₽')
    expect(out).toContain('12030₽')
    expect(out).toContain('5200')
    expect(out).toContain('42446')  // сорок две тысячи четыреста сорок шесть
    // Key non-number words must survive intact
    expect(out).toContain('бесплатно')
    expect(out).toContain('бесплатно.')
    expect(out).toContain('имплантация')
    expect(out).toContain('ортодонта')
  })

  it('слоты бота с временем ноль ноль через запятую', () => {
    const input = 'У доктора Нагаевой есть пятнадцать ноль ноль, у доктор Александровой — семнадцать ноль ноль, у доктор Нагаевой ещё есть в восемнадцать ноль ноль. К кому записывать?'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toContain('15:00')
    expect(out).toContain('17:00')
    expect(out).toContain('18:00')
    // Names must survive
    expect(out).toContain('Нагаевой')
    expect(out).toContain('Александровой')
  })

  it('несколько временных слотов в одном предложении', () => {
    const input = 'У доктор Александровой есть в десять, в четырнадцать и в семнадцать ноль ноль. Какое время вам удобно?'
    const out = wordsToDigits(input)
    console.log('ДО:', input)
    console.log('ПО:', out)
    expect(out).toContain('10')
    expect(out).toContain('14')
    expect(out).toContain('17:00')
    expect(out).toContain('Александровой')
    // Commas must survive
    expect(out).toContain(',')
  })

})
