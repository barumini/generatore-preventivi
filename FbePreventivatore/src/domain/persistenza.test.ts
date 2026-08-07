// src/domain/persistenza.test.ts
import { describe, expect, it } from 'vitest'
import { serializzaRevisione, deserializzaRevisione } from './persistenza'
import { eseguiCalcolo, type InputCalcolo } from './calcolo'
import { CATALOGO_VOCI } from './voci'
import { LISTINO_2026 } from './listino'

const STATO_FINTO = { esempio: 'qualsiasi valore JSON-serializzabile', numero: 42 }

const INPUT_MINIMO: InputCalcolo = {
  catalogo: CATALOGO_VOCI,
  configurazione: {
    livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
    numeroPianiAbitativi: 1,
    superficieGarage: 41,
    chiaviInManoNelTotale: false,
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
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  arrotondamento: 0,
}

// Golden case Crivellaro (cfr. CLAUDE.md): monopiano, garage 41 mq, chiavi in mano nel totale.
// Serve qui perché le 3 voci con `condizione` (solaio-interpiano escluso, opere-chiavi-in-mano
// e garage inclusi) sono esattamente quelle che un round-trip lossy falsificherebbe.
const INPUT_GOLDEN: InputCalcolo = {
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

describe('vincolo 6 — la revisione deserializzata RICALCOLA gli stessi numeri', () => {
  it('ri-eseguendo eseguiCalcolo sull\'input deserializzato ottiene lo stesso Listino, arrotondamento e numerazione', () => {
    const originale = eseguiCalcolo(INPUT_GOLDEN)
    const { statoForm, inputCalcolo, risultatoCalcolo } = serializzaRevisione(STATO_FINTO, INPUT_GOLDEN, originale)
    const ricostruito = deserializzaRevisione<typeof STATO_FINTO>(statoForm, inputCalcolo, risultatoCalcolo)

    // Non basta rileggere lo snapshot: il calcolo va RIFATTO sull'input deserializzato.
    // Se il catalogo perde i predicati di inclusione, `solaio-interpiano` rientra,
    // il Listino sale e l'arrotondamento inverso assorbe la differenza in silenzio.
    const ricalcolato = eseguiCalcolo(ricostruito.input)

    expect(ricalcolato.listinoTotale).toBe(originale.listinoTotale)
    expect(ricalcolato.arrotondamento).toBe(originale.arrotondamento)
    expect(ricalcolato.vociValorizzate.map((v) => v.numero)).toEqual(
      originale.vociValorizzate.map((v) => v.numero),
    )
    expect(ricalcolato.vociValorizzate.map((v) => v.id)).toEqual(
      originale.vociValorizzate.map((v) => v.id),
    )
    expect(ricalcolato.parziale).toBe(originale.parziale)
    expect(ricalcolato.totaleNetto).toBe(originale.totaleNetto)
  })

  it('non reintroduce le voci escluse per condizione: monopiano resta senza solaio interpiano', () => {
    const { statoForm, inputCalcolo, risultatoCalcolo } = serializzaRevisione(
      STATO_FINTO,
      INPUT_GOLDEN,
      eseguiCalcolo(INPUT_GOLDEN),
    )
    const ricostruito = deserializzaRevisione<typeof STATO_FINTO>(statoForm, inputCalcolo, risultatoCalcolo)
    const ricalcolato = eseguiCalcolo(ricostruito.input)

    expect(ricalcolato.vociValorizzate.find((v) => v.id === 'solaio-interpiano')).toBeUndefined()
    expect(ricalcolato.listinoTotale).toBe(237000)
    expect(ricalcolato.arrotondamento).toBe(1070)
  })
})

describe('serializzaRevisione / deserializzaRevisione', () => {
  it('fa un round-trip senza perdere dati, incluso il risultato calcolato', () => {
    const risultato = eseguiCalcolo(INPUT_MINIMO)
    const { statoForm, inputCalcolo, risultatoCalcolo } = serializzaRevisione(STATO_FINTO, INPUT_MINIMO, risultato)
    const ricostruito = deserializzaRevisione<typeof STATO_FINTO>(statoForm, inputCalcolo, risultatoCalcolo)

    expect(ricostruito.risultato.totaleNetto).toBe(risultato.totaleNetto)
    expect(ricostruito.risultato.listinoTotale).toBe(risultato.listinoTotale)
    expect(ricostruito.input.overrides).toEqual(INPUT_MINIMO.overrides)
  })

  it('congela il listino: mutare il listino "vivo" dopo il salvataggio non altera la revisione deserializzata', () => {
    const listinoMutabile = structuredClone(LISTINO_2026)
    const inputConCopia: InputCalcolo = { ...INPUT_MINIMO, listino: listinoMutabile }
    const risultato = eseguiCalcolo(inputConCopia)
    const { statoForm, inputCalcolo, risultatoCalcolo } = serializzaRevisione(STATO_FINTO, inputConCopia, risultato)

    // mutazione del listino "vivo" DOPO il salvataggio: se serializzaRevisione
    // avesse salvato un riferimento anziché una copia indipendente, questa
    // mutazione trapelerebbe nella revisione deserializzata.
    listinoMutabile.driver['pareti-mhm'] = { tipo: 'mq_superficie_lorda', eurMq: 999999 }

    const ricostruito = deserializzaRevisione<typeof STATO_FINTO>(statoForm, inputCalcolo, risultatoCalcolo)
    expect(ricostruito.risultato.totaleNetto).toBe(risultato.totaleNetto)
    expect(ricostruito.input.listino).not.toBe(listinoMutabile)
    expect((ricostruito.input.listino as typeof LISTINO_2026).driver['pareti-mhm']).not.toEqual(
      listinoMutabile.driver['pareti-mhm'],
    )
  })

  it('il round-trip preserva lo stato grezzo del wizard, non solo il calcolo', () => {
    const { statoForm, inputCalcolo, risultatoCalcolo } = serializzaRevisione(
      STATO_FINTO,
      INPUT_MINIMO,
      eseguiCalcolo(INPUT_MINIMO),
    )
    const ricostruito = deserializzaRevisione<typeof STATO_FINTO>(statoForm, inputCalcolo, risultatoCalcolo)
    expect(ricostruito.stato).toEqual(STATO_FINTO)
  })
})
