// src/app/preventivi/nuovo/stato-form.test.ts
import { describe, expect, it } from 'vitest'
import { inputCalcoloDaStato, livelliDaPacchetto, pacchettoDaLivelli, type StatoForm } from './stato-form'
import { creaCondizioniDefault } from '@/documento/condizioni-default'

const STATO_CRIVELLARO: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-07',
  luogo: 'Trissino',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [{ n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1, h: 2.2 }],
  perimetro: 60,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  chiaviInManoNelTotale: true,
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  overrides: {},
  totaleTarget: 300000,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
    spessoreEsterno: '',
    spessoreInterno: '',
    spessoreCoibente: '',
    spessoreCappotto: '',
  },
  condizioni: creaCondizioniDefault(),
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

  it('propaga la sicurezza (costo dichiarato e valorizzazione) da stato a input', () => {
    const statoConSicurezza: StatoForm = {
      ...STATO_CRIVELLARO,
      sicurezza: { costoDichiarato: 3500, valorizzata: 1800 },
    }
    const input = inputCalcoloDaStato(statoConSicurezza)
    expect(input.sicurezza).toEqual({ costoDichiarato: 3500, valorizzata: 1800 })
  })

  it('mappa gli spessori delle caratteristiche in input.spessori', () => {
    const input = inputCalcoloDaStato({
      ...STATO_CRIVELLARO,
      caratteristiche: { ...STATO_CRIVELLARO.caratteristiche, spessoreEsterno: '205', spessoreCappotto: '140' },
    })
    expect(input.spessori).toEqual({
      spessoreEsterno: '205',
      spessoreInterno: '',
      spessoreCoibente: '',
      spessoreCappotto: '140',
    })
  })
})

describe('pacchettoDaLivelli', () => {
  it('Grezzo: involucro impoverito, finiture escluso', () => {
    expect(pacchettoDaLivelli({ struttura: 'completo', involucro: 'impoverito', finiture: 'escluso' })).toBe('Grezzo')
  })

  it('Grezzo avanzato: involucro completo, finiture impoverito — golden case Crivellaro', () => {
    expect(pacchettoDaLivelli({ struttura: 'completo', involucro: 'completo', finiture: 'impoverito' })).toBe(
      'Grezzo avanzato',
    )
  })

  it('Chiavi in mano: involucro completo, finiture completo', () => {
    expect(pacchettoDaLivelli({ struttura: 'completo', involucro: 'completo', finiture: 'completo' })).toBe(
      'Chiavi in mano',
    )
  })

  it('chiaviInManoNelTotale=true su Crivellaro NON cambia il pacchetto (resta Grezzo avanzato, non Chiavi in mano)', () => {
    // Crivellaro: finiture impoverito + chiaviInManoNelTotale true, ma il documento reale
    // mostra "Grezzo avanzato" in copertina — il flag decide solo l'inclusione nel totale.
    expect(pacchettoDaLivelli(STATO_CRIVELLARO.livelli)).toBe('Grezzo avanzato')
  })
})

describe('livelliDaPacchetto', () => {
  it.each([
    ['grezzo', 'Grezzo'],
    ['grezzo avanzato', 'Grezzo avanzato'],
    ['chiavi in mano', 'Chiavi in mano'],
  ] as const)('%s va e torna invariato passando per pacchettoDaLivelli (tabella §5)', (pacchetto, etichettaAttesa) => {
    expect(pacchettoDaLivelli(livelliDaPacchetto(pacchetto))).toBe(etichettaAttesa)
  })

  it('grezzo avanzato: struttura completo, involucro completo, finiture impoverito — golden case Crivellaro', () => {
    expect(livelliDaPacchetto('grezzo avanzato')).toEqual({
      struttura: 'completo',
      involucro: 'completo',
      finiture: 'impoverito',
    })
  })
})
