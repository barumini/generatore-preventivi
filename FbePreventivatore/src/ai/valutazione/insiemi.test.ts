import { describe, expect, it } from 'vitest'
import { CASI_VALUTAZIONE, type CasoValutazione } from '../valutazione-estrazione'
import { CASI_AVVERSARI_ANAGRAFICA } from './avversari-anagrafica'
import { CASI_AVVERSARI_CONVERSAZIONE } from './avversari-conversazione'
import { CASI_AVVERSARI_FORMATI } from './avversari-formati'
import { INSIEMI_VALUTAZIONE } from './insiemi'

const contaControlli = (casi: CasoValutazione[]) => casi.reduce((n, c) => n + c.controlli.length, 0)

describe('INSIEMI_VALUTAZIONE', () => {
  it('sviluppo sono i casi Crivellaro, stessa lista', () => {
    expect(INSIEMI_VALUTAZIONE.sviluppo).toBe(CASI_VALUTAZIONE)
  })

  // I conteggi sono il denominatore delle valutazioni già misurate: se cambiano, i risultati
  // registrati non sono più confrontabili con quelli nuovi.
  it('conta i controlli: sviluppo 26 a ripetizione, controllo 26, avversari 83', () => {
    expect(contaControlli(INSIEMI_VALUTAZIONE.sviluppo)).toBe(26)
    expect(contaControlli(INSIEMI_VALUTAZIONE.controllo)).toBe(26)
    expect(contaControlli(INSIEMI_VALUTAZIONE.avversari)).toBe(83)
  })

  it('conta i casi: 3 di sviluppo, 5 di controllo, 12 avversari', () => {
    expect(INSIEMI_VALUTAZIONE.sviluppo).toHaveLength(3)
    expect(INSIEMI_VALUTAZIONE.controllo).toHaveLength(5)
    expect(INSIEMI_VALUTAZIONE.avversari).toHaveLength(12)
  })

  it('avversari sono formati, conversazione e anagrafica concatenati', () => {
    expect(INSIEMI_VALUTAZIONE.avversari).toEqual([
      ...CASI_AVVERSARI_FORMATI,
      ...CASI_AVVERSARI_CONVERSAZIONE,
      ...CASI_AVVERSARI_ANAGRAFICA,
    ])
    expect(contaControlli(CASI_AVVERSARI_FORMATI)).toBe(27)
    expect(contaControlli(CASI_AVVERSARI_CONVERSAZIONE)).toBe(28)
    expect(contaControlli(CASI_AVVERSARI_ANAGRAFICA)).toBe(28)
  })

  it('id dei casi unici su tutti gli insiemi', () => {
    const id = Object.values(INSIEMI_VALUTAZIONE).flatMap((casi) => casi.map((c) => c.id))
    expect(new Set(id).size).toBe(id.length)
  })

  // valutaCaso riporta gli esiti per nome: due controlli omonimi nello stesso caso sarebbero
  // indistinguibili nei resoconti.
  it('nomi dei controlli unici dentro ogni caso', () => {
    for (const caso of Object.values(INSIEMI_VALUTAZIONE).flat()) {
      const nomi = caso.controlli.map((k) => k.nome)
      expect(new Set(nomi).size, caso.id).toBe(nomi.length)
    }
  })

  it('ogni caso ha un testo e almeno un controllo', () => {
    for (const caso of Object.values(INSIEMI_VALUTAZIONE).flat()) {
      expect(caso.testo.trim(), caso.id).not.toBe('')
      expect(caso.controlli.length, caso.id).toBeGreaterThan(0)
    }
  })
})
