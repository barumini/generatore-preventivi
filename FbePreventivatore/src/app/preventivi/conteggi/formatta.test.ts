import { describe, expect, it } from 'vitest'
import { formattaEuro, formattaQuantita } from './formatta'

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
