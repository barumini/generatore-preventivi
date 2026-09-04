import { describe, expect, it } from 'vitest'
import { formattaEuro, formattaQuantita, importoDaTesto } from './formatta'

describe('formattaEuro', () => {
  it('usa lo spazio per le migliaia e la virgola decimale', () => {
    // convenzione CLAUDE.md: "96 100,00 €"
    expect(formattaEuro(96_100)).toBe('96 100,00 €')
    expect(formattaEuro(127_543.28)).toBe('127 543,28 €')
    expect(formattaEuro(4_000)).toBe('4 000,00 €')
  })

  it('non mette il separatore sotto il migliaio', () => {
    expect(formattaEuro(543.2)).toBe('543,20 €')
  })
})

describe('formattaQuantita', () => {
  it('accosta l’unità di misura', () => {
    expect(formattaQuantita(184.18, 'mq')).toBe('184,18 mq')
    expect(formattaQuantita(14, 'nr')).toBe('14 nr')
  })
})

describe('importoDaTesto', () => {
  it('legge la convenzione italiana, col punto o lo spazio per le migliaia', () => {
    expect(importoDaTesto('13200')).toBe(13_200)
    expect(importoDaTesto('13.200,00')).toBe(13_200)
    expect(importoDaTesto('13 200,00')).toBe(13_200)
    expect(importoDaTesto('105 987,63')).toBe(105_987.63)
    expect(importoDaTesto('1.070,00')).toBe(1_070)
    expect(importoDaTesto('13200,50')).toBe(13_200.5)
    expect(importoDaTesto('-5000')).toBe(-5_000)
  })

  it('non indovina: rifiuta ciò che non riconosce', () => {
    // era il bug: parseFloat si fermava al secondo punto e dava 13,2
    expect(importoDaTesto('13.200.00')).toBeNull()
    expect(importoDaTesto('13200.50')).toBeNull()
    expect(importoDaTesto('tredicimila')).toBeNull()
    expect(importoDaTesto('12,345')).toBeNull()
    expect(importoDaTesto('')).toBeNull()
    expect(importoDaTesto('   ')).toBeNull()
  })

  it('normalizza gli spazi non separabili (copia-incolla da PDF/Excel)', () => {
    // U+00A0 (non-breaking) e U+202F (narrow no-break): scritti come escape \u,
    // non come caratteri invisibili in sorgente.
    expect(importoDaTesto('13\u00A0200,00')).toBe(13_200)
    expect(importoDaTesto('13\u202F200,00')).toBe(13_200)
  })
})
