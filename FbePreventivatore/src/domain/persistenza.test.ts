// src/domain/persistenza.test.ts
import { describe, expect, it } from 'vitest'
import { serializzaRevisione, deserializzaRevisione } from './persistenza'
import { eseguiCalcolo, type InputCalcolo } from './calcolo'
import { CATALOGO_VOCI } from './voci'
import { LISTINO_2026 } from './listino'

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

describe('serializzaRevisione / deserializzaRevisione', () => {
  it('fa un round-trip senza perdere dati, incluso il risultato calcolato', () => {
    const risultato = eseguiCalcolo(INPUT_MINIMO)
    const { inputCalcolo, risultatoCalcolo } = serializzaRevisione(INPUT_MINIMO, risultato)
    const ricostruito = deserializzaRevisione(inputCalcolo, risultatoCalcolo)

    expect(ricostruito.risultato.totaleNetto).toBe(risultato.totaleNetto)
    expect(ricostruito.risultato.listinoTotale).toBe(risultato.listinoTotale)
    expect(ricostruito.input.overrides).toEqual(INPUT_MINIMO.overrides)
  })

  it('congela il listino: mutare il listino "vivo" dopo il salvataggio non altera la revisione deserializzata', () => {
    const listinoMutabile = structuredClone(LISTINO_2026)
    const inputConCopia: InputCalcolo = { ...INPUT_MINIMO, listino: listinoMutabile }
    const risultato = eseguiCalcolo(inputConCopia)
    const { inputCalcolo, risultatoCalcolo } = serializzaRevisione(inputConCopia, risultato)

    // mutazione del listino "vivo" DOPO il salvataggio: se serializzaRevisione
    // avesse salvato un riferimento anziché una copia indipendente, questa
    // mutazione trapelerebbe nella revisione deserializzata.
    listinoMutabile.driver['pareti-mhm'] = { tipo: 'mq_superficie_lorda', eurMq: 999999 }

    const ricostruito = deserializzaRevisione(inputCalcolo, risultatoCalcolo)
    expect(ricostruito.risultato.totaleNetto).toBe(risultato.totaleNetto)
    expect(ricostruito.input.listino).not.toBe(listinoMutabile)
    expect((ricostruito.input.listino as typeof LISTINO_2026).driver['pareti-mhm']).not.toEqual(
      listinoMutabile.driver['pareti-mhm'],
    )
  })
})
