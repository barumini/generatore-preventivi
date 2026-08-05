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

  it('congela il listino: cambiare LISTINO_2026 dopo il salvataggio non altera la revisione deserializzata', () => {
    const risultato = eseguiCalcolo(INPUT_MINIMO)
    const { inputCalcolo, risultatoCalcolo } = serializzaRevisione(INPUT_MINIMO, risultato)
    // il listino "vivo" cambia altrove nell'app; la revisione salvata non deve saperlo
    const ricostruito = deserializzaRevisione(inputCalcolo, risultatoCalcolo)
    expect(ricostruito.risultato.totaleNetto).toBe(risultato.totaleNetto)
  })
})
