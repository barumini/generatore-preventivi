import { describe, expect, it } from 'vitest'
import { estraiComputo, verificaIntegrita, numeroItaliano, type Computo } from './estrai-voci'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])
const CASI: Array<[string, Computo, number]> = [
  ['dacroce', dacroce, 323_643.58],
  ['crivellaro', crivellaro, 260_260.99],
]

describe('numeroItaliano', () => {
  it('legge la virgola decimale e il punto delle migliaia', () => {
    expect(numeroItaliano('4,29')).toBe(4.29)
    expect(numeroItaliano('1.373,56')).toBe(1373.56)
  })

  it("legge l'apostrofo tipografico che Primus usa per le migliaia", () => {
    expect(numeroItaliano('4´832,54')).toBe(4832.54)
    expect(numeroItaliano('260´260,99')).toBe(260260.99)
  })

  it('rifiuta ciò che non è un numero', () => {
    expect(numeroItaliano('SOMMANO')).toBeNull()
    expect(numeroItaliano('')).toBeNull()
  })
})

describe('estraiComputo', () => {
  it.each(CASI)('%s ha 166 voci, tutte con tariffa', (_nome, computo) => {
    expect(computo.voci).toHaveLength(166)
    expect(computo.voci.filter((v) => v.tariffa === null)).toEqual([])
  })

  it.each(CASI)('%s numera le voci consecutivamente da 1', (_nome, computo) => {
    expect(computo.voci.map((v) => v.numero)).toEqual(
      Array.from({ length: 166 }, (_, i) => i + 1),
    )
  })

  it.each(CASI)('%s ricompone il totale dal riepilogo', (_nome, computo, totale) => {
    expect(computo.totale).toBe(totale)
  })

  it.each(CASI)('%s pareggia le voci col riepilogo', (_nome, computo) => {
    const esito = verificaIntegrita(computo)
    expect(esito.coerente).toBe(true)
    expect(esito.totaleVoci).toBe(esito.totaleRiepilogo)
  })

  it('legge le otto categorie del riepilogo strutturale', () => {
    expect(dacroce.riepilogo['M:001.001']).toEqual({
      nome: 'PARETI IN LEGNO',
      importo: 105_987.63,
    })
    expect(dacroce.riepilogo['M:001.002'].importo).toBe(15_240.96)
    expect(crivellaro.riepilogo['M:001.002'].importo).toBe(0)
    expect(Object.keys(dacroce.riepilogo)).toHaveLength(8)
  })

  it('assegna a ogni voce la categoria in cui cade', () => {
    const voce = dacroce.voci.find((v) => v.numero === 59)!
    expect(voce.categoria).toBe('COPERTURA')
    expect(dacroce.voci.find((v) => v.numero === 2)!.categoria).toBe('PARETI IN LEGNO')
  })

  it('legge unità, quantità, prezzo unitario e totale dalla riga SOMMANO', () => {
    const voce = dacroce.voci.find((v) => v.numero === 6)!
    expect(voce.tariffa).toBe('104.01.018')
    expect(voce.unita).toBe('m')
    expect(voce.quantita).toBe(82.2)
    expect(voce.prezzoUnitario).toBe(58.79)
    expect(voce.totale).toBe(4832.54)
  })

  it('tiene distinte le voci che condividono la tariffa', () => {
    const occorrenze = crivellaro.voci.filter((v) => v.tariffa === '104.02.000')
    expect(occorrenze.map((v) => [v.numero, v.quantita])).toEqual([
      [58, 42.84],
      [59, 186.35],
    ])
    expect(occorrenze[0].descrizione).toContain('SPORTO')
    expect(occorrenze[1].descrizione).toContain('FALDA')
  })

  it('conserva la descrizione anche quando occupa più righe', () => {
    const voce = dacroce.voci.find((v) => v.numero === 20)!
    expect(voce.descrizione).toContain('PARETE ESTERNA')
    expect(voce.descrizione).toContain('11 strati')
  })
})
