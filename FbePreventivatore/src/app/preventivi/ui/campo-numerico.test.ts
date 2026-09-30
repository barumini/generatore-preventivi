import { describe, expect, it } from 'vitest'
import { testoCoerente, testoDaValore, valoreDaTesto } from './campo-numerico'

describe('campo numerico', () => {
  it('mostra lo zero come campo vuoto', () => {
    expect(testoDaValore(0)).toBe('')
    expect(testoDaValore(12.5)).toBe('12.5')
    expect(testoDaValore(0.07 * 100)).toBe('7')
  })

  it('tratta il campo svuotato come 0', () => {
    expect(valoreDaTesto('')).toBe(0)
    expect(valoreDaTesto('  ')).toBe(0)
    expect(valoreDaTesto('10')).toBe(10)
  })

  it('considera coerente il testo digitato col valore riscalato in virgola mobile', () => {
    expect(testoCoerente('7', 0.07 * 100)).toBe(true)
    expect(testoCoerente('', 0)).toBe(true)
    expect(testoCoerente('0', 0)).toBe(true)
    expect(testoCoerente('5', 10)).toBe(false)
  })
})
