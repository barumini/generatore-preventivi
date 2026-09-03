import { describe, expect, it } from 'vitest'
import { estraiComputo } from './estrai-voci'
import {
  vociPerTariffa,
  sommaTotali,
  sommaQuantita,
  voceUnica,
  VoceNonUnivocaError,
} from './accesso'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])

/** Le sette tariffe che compaiono due volte in entrambi i computi. */
const RIPETUTE = [
  '103.02.09', '104.01.015', '104.01.016', '104.02.000',
  '104.02.006', '104.02.018', '104.02.021',
]

describe('vociPerTariffa', () => {
  it('restituisce tutte le occorrenze, non la prima', () => {
    expect(vociPerTariffa(crivellaro, '104.02.000').map((v) => v.numero)).toEqual([58, 59])
  })

  it('restituisce una lista vuota per una tariffa assente', () => {
    expect(vociPerTariffa(dacroce, '999.99.99')).toEqual([])
  })

  it.each([
    ['dacroce', dacroce],
    ['crivellaro', crivellaro],
  ])('in %s le sette tariffe ripetute hanno due occorrenze ciascuna', (_nome, computo) => {
    for (const tariffa of RIPETUTE) {
      expect(vociPerTariffa(computo, tariffa)).toHaveLength(2)
    }
  })

  it('non disambigua per categoria: 104.02.021 sta in due categorie diverse', () => {
    const occorrenze = vociPerTariffa(dacroce, '104.02.021')
    expect(occorrenze.map((v) => v.categoria)).toEqual(['PARETI IN LEGNO', 'COPERTURA'])
    expect(occorrenze.every((v) => (v.quantita ?? 0) > 0)).toBe(true)
  })
})

describe('sommaTotali', () => {
  it('somma su più tariffe e su più occorrenze', () => {
    expect(sommaTotali(dacroce, '109.04.12', '109.04.13', '109.04.14')).toBe(14_495)
    expect(sommaTotali(crivellaro, '109.04.12', '109.04.13', '109.04.14')).toBe(9_450)
  })

  it('vale zero se nessuna tariffa è presente', () => {
    expect(sommaTotali(dacroce, '999.99.99')).toBe(0)
  })
})

describe('sommaQuantita', () => {
  it('somma le quantità di tutte le occorrenze', () => {
    // falda 186,35 + sporto 42,84: non è la quantità che serve alla regola
    // copertura, ed è esattamente per questo che la regola usa voceUnica
    expect(sommaQuantita(crivellaro, '104.02.000')).toBe(229.19)
  })

  it('legge la superficie del cappotto e del cartongesso', () => {
    expect(sommaQuantita(dacroce, '204.03.08')).toBe(195.16)
    expect(sommaQuantita(dacroce, '107.04.01')).toBe(531.1)
    expect(sommaQuantita(crivellaro, '204.03.08')).toBe(191.58)
    expect(sommaQuantita(crivellaro, '107.04.01')).toBe(432.46)
  })
})

describe('voceUnica', () => {
  it('sceglie la riga a falda fra due che condividono la tariffa', () => {
    expect(voceUnica(crivellaro, '104.02.000', /FALDA/).quantita).toBe(186.35)
    expect(voceUnica(dacroce, '104.02.000', /FALDA/).quantita).toBe(184.18)
  })

  it('funziona senza filtro quando la tariffa compare una volta sola', () => {
    expect(voceUnica(dacroce, '107.04.01').quantita).toBe(531.1)
  })

  it('solleva se le corrispondenze sono più di una', () => {
    expect(() => voceUnica(crivellaro, '104.02.000')).toThrow(VoceNonUnivocaError)
    expect(() => voceUnica(crivellaro, '104.02.000')).toThrow(/2 voci/)
  })

  it('solleva se non ci sono corrispondenze', () => {
    expect(() => voceUnica(dacroce, '999.99.99')).toThrow(VoceNonUnivocaError)
    expect(() => voceUnica(dacroce, '104.02.000', /PIANA/)).toThrow(VoceNonUnivocaError)
  })
})
