import { describe, expect, it } from 'vitest'
import { isProtocolloPlaceholder, verificaCoerenza } from './coerenza'
import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { CATALOGO_VOCI } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import type { SuperficiePiano } from '@/domain/geometria'

const INPUT_BASE: InputCalcolo = {
  catalogo: CATALOGO_VOCI,
  configurazione: {
    livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
    numeroPianiAbitativi: 1,
    superficieGarage: 41,
    chiaviInManoNelTotale: true,
  },
  listino: LISTINO_2026,
  geometria: {
    superficiLordeTotale: 161,
    superficieSedime: 134,
    superficieGarage: 41,
    perimetro: 60,
    serramenti: { areaLordaTotale: 30.5, numero: 11 },
  },
  overrides: {},
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }, { percentuale: 0.1, causale: 'conferma' }],
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  arrotondamento: { risolviPerTotale: 300000 },
}

const SUPERFICI_COERENTI: SuperficiePiano[] = [
  { piano: 'Piano Terra', valoreLordo: '134' },
  { piano: 'Portico', valoreLordo: '13+14' },
]

describe('verificaCoerenza', () => {
  it('non segnala nulla su un caso pienamente coerente', () => {
    const risultato = eseguiCalcolo({
      ...INPUT_BASE,
      spessori: { spessoreEsterno: '205', spessoreInterno: '160', spessoreCoibente: '200', spessoreCappotto: '140' },
    })
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })
    expect(avvisi).toHaveLength(0)
  })

  it('segnala se la somma delle superfici non coincide col totale dichiarato', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 187, // come nel bug reale del rev.00 (somma reale 193,5)
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })
    expect(avvisi.some((a) => a.tipo === 'superfici-incoerenti')).toBe(true)
  })

  it('segnala un placeholder di protocollo non sostituito', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: true,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })
    expect(avvisi.some((a) => a.tipo === 'placeholder-non-sostituito')).toBe(true)
  })

  it('segnala le sezioni ancora marcate "da definire"', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: ['Scuri', 'Avvolgibili'],
      riferimentiTestuali: [],
    })
    expect(avvisi.filter((a) => a.tipo === 'sezione-da-definire')).toHaveLength(2)
  })

  it('segnala un arrotondamento sopra la soglia del 2%', () => {
    const inputConArrotondamentoAlto: InputCalcolo = { ...INPUT_BASE, arrotondamento: 10000 }
    const risultato = eseguiCalcolo(inputConArrotondamentoAlto)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })
    expect(avvisi.some((a) => a.tipo === 'arrotondamento-eccessivo')).toBe(true)
  })

  it('non segnala nulla se ogni riferimento testuale cita un numero di voce esistente', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [{ numeroCitato: '1.a', contesto: 'nota a piè pagina 3' }],
    })
    expect(avvisi.filter((a) => a.tipo === 'riferimento-voce-inesistente')).toHaveLength(0)
  })

  it('segnala una nota che cita un numero di voce non più presente nella numerazione (bug reale Lucarelli)', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [{ numeroCitato: '9', contesto: 'nota a piè pagina 3' }], // '9' non esiste in questa numerazione
    })
    const trovato = avvisi.find((a) => a.tipo === 'riferimento-voce-inesistente')
    expect(trovato).toBeDefined()
    expect(trovato?.messaggio).toContain('9')
  })
})

describe('isProtocolloPlaceholder', () => {
  it('considera placeholder una stringa vuota o solo spazi', () => {
    expect(isProtocolloPlaceholder('')).toBe(true)
    expect(isProtocolloPlaceholder('   ')).toBe(true)
  })

  it('considera placeholder un codice bozza generato in automatico', () => {
    expect(isProtocolloPlaceholder('BOZZA-2026-04821')).toBe(true)
  })

  it('non considera placeholder un protocollo FBE reale', () => {
    expect(isProtocolloPlaceholder('2026059')).toBe(false)
  })
})

describe('verificaCoerenza — spessori non interpolati', () => {
  it('segnala i placeholder di spessore residui nelle descrizioni voce', () => {
    const risultato = eseguiCalcolo(INPUT_BASE) // nessun `spessori`: pareti-mhm/copertura-falda/cappotto restano con {{...}}
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })

    const avviso = avvisi.find((a) => a.tipo === 'spessore-non-interpolato')
    expect(avviso).toBeDefined()
    expect(avviso!.messaggio).toContain('{{spessoreEsterno}}')
    expect(avviso!.messaggio).toContain('{{spessoreCappotto}}')
  })

  it('non segnala nulla quando tutti gli spessori sono compilati', () => {
    const risultato = eseguiCalcolo({
      ...INPUT_BASE,
      spessori: { spessoreEsterno: '205', spessoreInterno: '160', spessoreCoibente: '200', spessoreCappotto: '140' },
    })
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })

    expect(avvisi.find((a) => a.tipo === 'spessore-non-interpolato')).toBeUndefined()
  })
})
