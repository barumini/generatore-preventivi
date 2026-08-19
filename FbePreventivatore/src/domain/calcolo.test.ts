import { describe, expect, it } from 'vitest'
import {
  applicaScontiACascata,
  calcolaParziale,
  risolviArrotondamento,
  sogliaArrotondamentoSuperata,
  interpolaPlaceholder,
  segmentaPlaceholder,
  type ParametriSconto,
} from './calcolo'
import { eseguiCalcolo, type InputCalcolo } from './calcolo'
import { CATALOGO_VOCI } from './voci'
import { LISTINO_2026 } from './listino'

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

describe('eseguiCalcolo — golden case Crivellaro end-to-end', () => {
  const input: InputCalcolo = {
    catalogo: CATALOGO_VOCI,
    configurazione: {
      livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
      numeroPianiAbitativi: 1,
      superficieGarage: 41,
      chiaviInManoNelTotale: true, // Crivellaro somma "opere-chiavi-in-mano" nel totale (§3.9)
    },
    listino: LISTINO_2026,
    geometria: {
      superficiLordeTotale: 161,
      superficieSedime: 134, // impronta Piano Terra, driver di copertura-falda (§3.9)
      superficieGarage: 41,
      perimetro: 60,
      serramenti: { areaLordaTotale: 30.5, numero: 11 },
    },
    overrides: {
      'pareti-mhm': 96100,
      'trave-larice': 5800,
      'copertura-falda': 63600,
      cappotto: 20300,
      'cartongesso-q2': 15500,
      'assistenza-cartongessisti': 2200,
      'infissi-pvc': 19300,
      monoblocchi: 10200,
      'progettazione-esecutiva': 4000,
      'opere-chiavi-in-mano': 89100,
      garage: 20000,
    },
    sconti: [
      { percentuale: 0.1, causale: 'sconto cliente' },
      { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' },
    ],
    sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
    arrotondamento: { risolviPerTotale: 300000 },
  }

  it('riproduce esattamente 237 000 / 190 900 / 300 000', () => {
    const risultato = eseguiCalcolo(input)
    expect(risultato.listinoTotale).toBe(237000)
    expect(risultato.sconti[0].importoCalcolato).toBe(23700)
    expect(risultato.sconti[1].importoCalcolato).toBe(21330)
    expect(risultato.arrotondamento).toBe(1070)
    expect(risultato.parziale).toBe(190900)
    expect(risultato.totaleNetto).toBe(300000)
  })

  it('numera le voci valorizzate come nel documento reale', () => {
    const risultato = eseguiCalcolo(input)
    const numeri = risultato.vociValorizzate.map((v) => v.numero)
    expect(numeri).toEqual(['1', '1.a', '1.b', '1.c', '2', '3', '4', '4.a', '5', '5.a', '6', '7', '8'])
  })

  it('marca ogni voce con override come provenienza "manuale"', () => {
    const risultato = eseguiCalcolo(input)
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    expect(pareti.importo).toBe(96100)
    expect(pareti.provenienza).toBe('manuale')
  })

  it('propone dal listino le voci senza override, con provenienza "proposto"', () => {
    const { ...senzaOverridePareti } = input
    const risultato = eseguiCalcolo({ ...senzaOverridePareti, overrides: {} })
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    expect(pareti.provenienza).toBe('proposto')
    expect(pareti.importo).toBeGreaterThan(0)
  })

  it('mantiene comprese le voci testuali senza farle entrare nella somma', () => {
    const risultato = eseguiCalcolo(input)
    const tracciamento = risultato.vociValorizzate.find((v) => v.id === 'tracciamento-impianti')!
    expect(tracciamento.importo).toBe('comprese')
  })

  it('non scala il post_sconto: sicurezza OMAGGIO non entra nel totale', () => {
    const risultato = eseguiCalcolo(input)
    expect(risultato.sicurezza.valorizzata).toBe('OMAGGIO')
    // 190 900 (parziale) + 89 100 (chiavi in mano) + 20 000 (garage) + 0 (sicurezza) = 300 000
    expect(risultato.totaleNetto).toBe(300000)
  })

  it('interpola i placeholder di spessore quando input.spessori è fornito', () => {
    const risultato = eseguiCalcolo({
      ...input,
      spessori: { spessoreEsterno: '205', spessoreInterno: '160', spessoreCoibente: '200', spessoreCappotto: '140' },
    })
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    const cappotto = risultato.vociValorizzate.find((v) => v.id === 'cappotto')!
    expect(pareti.descrizione).toContain('sp. mm 205')
    expect(pareti.descrizione).toContain('sp. mm 160')
    expect(pareti.descrizione).not.toContain('{{')
    expect(cappotto.descrizione).toContain('sp. mm 140')
  })

  it('senza input.spessori, lascia i placeholder di spessore intatti (comportamento invariato)', () => {
    const risultato = eseguiCalcolo(input)
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    expect(pareti.descrizione).toContain('{{spessoreEsterno}}')
    expect(pareti.descrizione).toContain('{{spessoreInterno}}')
  })
})

describe('interpolaPlaceholder', () => {
  it('sostituisce un token con il valore corrispondente', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', { spessoreEsterno: '205' })).toBe('sp. mm 205')
  })

  it('lascia intatto un token il cui valore è assente', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', {})).toBe('sp. mm {{spessoreEsterno}}')
  })

  it('lascia intatto un token il cui valore è una stringa vuota o solo spazi', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', { spessoreEsterno: '   ' })).toBe('sp. mm {{spessoreEsterno}}')
  })

  it('lascia intatto ogni token quando valori è undefined', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', undefined)).toBe('sp. mm {{spessoreEsterno}}')
  })

  it('sostituisce più token distinti nella stessa stringa', () => {
    const risultato = interpolaPlaceholder('esterne sp. mm {{spessoreEsterno}} ed interne sp. mm {{spessoreInterno}}', {
      spessoreEsterno: '205',
      spessoreInterno: '160',
    })
    expect(risultato).toBe('esterne sp. mm 205 ed interne sp. mm 160')
  })

  it('accetta un valore composito, senza interpretarlo', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', { spessoreEsterno: '205-160' })).toBe('sp. mm 205-160')
  })

  it('non tocca una stringa senza placeholder', () => {
    expect(interpolaPlaceholder('Trave alla base in larice', { spessoreEsterno: '205' })).toBe('Trave alla base in larice')
  })
})

describe('segmentaPlaceholder', () => {
  it('produce un solo segmento non-placeholder per una stringa senza token', () => {
    expect(segmentaPlaceholder('Trave alla base in larice')).toEqual([
      { testo: 'Trave alla base in larice', placeholder: false },
    ])
  })

  it('separa testo e placeholder preservando ordine e contenuto', () => {
    const segmenti = segmentaPlaceholder('sp. mm {{spessoreEsterno}} fine')
    expect(segmenti).toEqual([
      { testo: 'sp. mm ', placeholder: false },
      { testo: '{{spessoreEsterno}}', placeholder: true },
      { testo: ' fine', placeholder: false },
    ])
  })

  it('gestisce più placeholder nella stessa stringa', () => {
    const segmenti = segmentaPlaceholder('esterne sp. mm {{spessoreEsterno}} ed interne sp. mm {{spessoreInterno}}')
    expect(segmenti.filter((s) => s.placeholder).map((s) => s.testo)).toEqual([
      '{{spessoreEsterno}}',
      '{{spessoreInterno}}',
    ])
  })

  it('non produce un segmento vuoto finale quando la stringa termina con un placeholder', () => {
    const segmenti = segmentaPlaceholder('sp. mm {{spessoreEsterno}}')
    expect(segmenti).toEqual([
      { testo: 'sp. mm ', placeholder: false },
      { testo: '{{spessoreEsterno}}', placeholder: true },
    ])
  })
})
