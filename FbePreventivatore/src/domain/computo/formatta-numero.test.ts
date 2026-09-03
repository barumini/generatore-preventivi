import { describe, expect, it } from 'vitest'
import { numeroIt, quantitaIt } from './formatta-numero'

describe('numeroIt', () => {
  it('usa lo spazio per le migliaia e la virgola decimale', () => {
    expect(numeroIt(68_428.78)).toBe('68 428,78')
    expect(numeroIt(105_987.63)).toBe('105 987,63')
    expect(numeroIt(220, 0)).toBe('220')
  })

  it('separa le migliaia anche quando la parte intera ha 4 cifre', () => {
    expect(numeroIt(1_070)).toBe('1 070,00')
    expect(numeroIt(5_843.7)).toBe('5 843,70')
    expect(numeroIt(9_999.99)).toBe('9 999,99')
  })

  it('non separa sotto il migliaio', () => {
    expect(numeroIt(543.2)).toBe('543,20')
  })

  it('tratta i decimali come limite, non solo come minimo', () => {
    expect(numeroIt(1_234.5, 0)).toBe('1 235')
  })
})

describe('quantitaIt', () => {
  it('omette i decimali sugli interi', () => {
    expect(quantitaIt(14)).toBe('14')
    expect(quantitaIt(184.18)).toBe('184,18')
  })
})
