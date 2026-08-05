import { describe, expect, it } from 'vitest'
import {
  applicaScontiACascata,
  calcolaParziale,
  risolviArrotondamento,
  sogliaArrotondamentoSuperata,
  type ParametriSconto,
} from './calcolo'

const SCONTI_CRIVELLARO: ParametriSconto[] = [
  { percentuale: 0.1, causale: 'sconto cliente' },
  { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' },
]

describe('applicaScontiACascata — golden case Crivellaro', () => {
  it('applica il secondo sconto al residuo, non al totale originale', () => {
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    expect(sconti).toHaveLength(2)
    expect(sconti[0].importoCalcolato).toBe(23700)
    expect(sconti[1].importoCalcolato).toBe(21330)
  })

  it('10% + 10% fa 19%, non 20%, sul totale originale', () => {
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    const totaleSconti = sconti.reduce((somma, s) => somma + s.importoCalcolato, 0)
    expect(totaleSconti).toBe(45030)
    expect(totaleSconti / 237000).toBeCloseTo(0.19, 4)
  })
})

describe('calcolaParziale — golden case Crivellaro', () => {
  it('riproduce il PARZIALE AL GREZZO AVANZATO = 190 900,00', () => {
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    expect(calcolaParziale(237000, sconti, 1070)).toBe(190900)
  })
})

describe('risolviArrotondamento — funzione inversa', () => {
  it('dato un totale target di 300 000, risolve l\'arrotondamento a 1 070,00', () => {
    const arrotondamento = risolviArrotondamento(237000, SCONTI_CRIVELLARO, 300000, 109100)
    expect(arrotondamento).toBe(1070)
  })

  it('è coerente con calcolaParziale: applicando l\'arrotondamento risolto si ottiene il parziale corretto', () => {
    const arrotondamento = risolviArrotondamento(237000, SCONTI_CRIVELLARO, 300000, 109100)
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    const parziale = calcolaParziale(237000, sconti, arrotondamento)
    expect(parziale + 109100).toBe(300000)
  })
})

describe('sogliaArrotondamentoSuperata', () => {
  it('non segnala nulla per 1 070 su un listino di 237 000 (0,45%)', () => {
    expect(sogliaArrotondamentoSuperata(1070, 237000)).toBe(false)
  })

  it('segnala un arrotondamento sopra la soglia del 2%', () => {
    expect(sogliaArrotondamentoSuperata(5000, 237000)).toBe(true)
  })
})
