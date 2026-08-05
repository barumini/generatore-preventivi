// src/app/preventivi/nuovo/stato-form.test.ts
import { describe, expect, it } from 'vitest'
import { inputCalcoloDaStato, type StatoForm } from './stato-form'

const STATO_CRIVELLARO: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [{ n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1, h: 2.2 }],
  perimetro: 60,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  chiaviInManoNelTotale: true,
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  overrides: {},
  totaleTarget: 300000,
}

describe('inputCalcoloDaStato', () => {
  it('deriva superficiLordeTotale e superficieGarage dalle superfici del form', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.geometria.superficiLordeTotale).toBe(161)
    expect(input.geometria.superficieGarage).toBe(41)
  })

  it('deriva superficieSedime dalla riga Piano Terra', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.geometria.superficieSedime).toBe(134)
  })

  it('deriva numeroPianiAbitativi per la configurazione voci', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.configurazione.numeroPianiAbitativi).toBe(1)
  })

  it('propaga chiaviInManoNelTotale alla configurazione voci', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.configurazione.chiaviInManoNelTotale).toBe(true)
  })

  it('imposta arrotondamento come risoluzione sul totale target', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.arrotondamento).toEqual({ risolviPerTotale: 300000 })
  })

  it('usa la somma calcolata delle superfici come proposta di default per superficiLordeTotale', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.geometria.superficiLordeTotale).toBe(161) // nessun totaleLordoManuale impostato
  })

  it('usa totaleLordoManuale al posto della somma calcolata quando presente (spec §3.9, convenzione Zapparoni)', () => {
    const statoConOverride = { ...STATO_CRIVELLARO, totaleLordoManuale: 310 }
    const input = inputCalcoloDaStato(statoConOverride)
    expect(input.geometria.superficiLordeTotale).toBe(310)
  })
})
