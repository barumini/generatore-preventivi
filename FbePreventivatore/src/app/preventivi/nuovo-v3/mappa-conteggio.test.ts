import { describe, expect, it } from 'vitest'
import { mappaConteggioAOverride, numeroPianiAbitativiDalComputo } from './mappa-conteggio'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'
import type { ConfigurazioneVoci } from '@/domain/voci'

function voceConteggiata(parziale: Partial<VoceConteggiata>): VoceConteggiata {
  return {
    idMaster: 'pareti-mhm',
    descrizione: '',
    passaggi: [],
    formula: '',
    importo: 0,
    provenienza: 'calcolato',
    ...parziale,
  }
}

const TUTTO_INCLUSO: ConfigurazioneVoci = {
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'completo' },
  numeroPianiAbitativi: 2,
  superficieGarage: 0,
  chiaviInManoNelTotale: false,
}

describe('mappaConteggioAOverride', () => {
  it('scrive un override numerico per una voce presente nel catalogo e inclusa dalla configurazione', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 127543.28 })],
      {},
      TUTTO_INCLUSO,
    )
    expect(esito.overrides['pareti-mhm']).toBe(127543.28)
    expect(esito.vociScartate).toEqual([])
    expect(esito.vociEscluseDallaConfigurazione).toEqual([])
  })

  it("converte l'importo 'compresa' del conteggio in 'comprese' del wizard", () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'solaio-interpiano', importo: 'compresa' })],
      {},
      TUTTO_INCLUSO,
    )
    expect(esito.overrides['solaio-interpiano']).toBe('comprese')
  })

  it('non sovrascrive un override già presente per una voce che il conteggio non tocca', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 })],
      { garage: 12000 },
      TUTTO_INCLUSO,
    )
    expect(esito.overrides.garage).toBe(12000)
    expect(esito.overrides['pareti-mhm']).toBe(100000)
  })

  it('scarta le voci del conteggio senza corrispondenza nel catalogo attuale', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'copertura-piana', importo: 'compresa' })],
      {},
      TUTTO_INCLUSO,
    )
    expect(esito.overrides['copertura-piana']).toBeUndefined()
    expect(esito.vociScartate).toEqual(['copertura-piana'])
  })

  it('un conteggio più recente sovrascrive un override scritto da un conteggio precedente', () => {
    const primo = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 })],
      {},
      TUTTO_INCLUSO,
    )
    const secondo = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 105000 })],
      primo.overrides,
      TUTTO_INCLUSO,
    )
    expect(secondo.overrides['pareti-mhm']).toBe(105000)
  })

  it('scarta le voci del catalogo escluse dalla configurazione corrente, senza scriverle in overrides', () => {
    const finitureEscluse: ConfigurazioneVoci = {
      livelli: { struttura: 'completo', involucro: 'completo', finiture: 'escluso' },
      numeroPianiAbitativi: 1,
      superficieGarage: 0,
      chiaviInManoNelTotale: false,
    }
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'cartongesso-q2', importo: 15000 })],
      {},
      finitureEscluse,
    )
    expect(esito.overrides['cartongesso-q2']).toBeUndefined()
    expect(esito.vociEscluseDallaConfigurazione).toEqual(['cartongesso-q2'])
    expect(esito.vociScartate).toEqual([])
  })

  it('non chiama in causa la configurazione per una voce già scartata perché fuori catalogo', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'veletta-perimetrale', importo: 'compresa' })],
      {},
      TUTTO_INCLUSO,
    )
    expect(esito.vociScartate).toEqual(['veletta-perimetrale'])
    expect(esito.vociEscluseDallaConfigurazione).toEqual([])
  })

  it('un array vuoto di voci lascia gli override attuali invariati', () => {
    const esito = mappaConteggioAOverride([], { garage: 12000 }, TUTTO_INCLUSO)
    expect(esito.overrides).toEqual({ garage: 12000 })
    expect(esito.vociScartate).toEqual([])
    expect(esito.vociEscluseDallaConfigurazione).toEqual([])
  })

  it('in una sola chiamata scarta solo la voce fuori catalogo e applica quella valida', () => {
    const esito = mappaConteggioAOverride(
      [
        voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 }),
        voceConteggiata({ idMaster: 'copertura-piana', importo: 'compresa' }),
      ],
      {},
      TUTTO_INCLUSO,
    )
    expect(esito.overrides['pareti-mhm']).toBe(100000)
    expect(esito.overrides['copertura-piana']).toBeUndefined()
    expect(esito.vociScartate).toEqual(['copertura-piana'])
  })
})

describe('numeroPianiAbitativiDalComputo', () => {
  it('restituisce 1 (monopiano) se il computo non ha una voce solaio-interpiano', () => {
    expect(numeroPianiAbitativiDalComputo([voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 })])).toBe(1)
  })

  it("restituisce 1 se solaio-interpiano vale 'compresa' (categoria SOLAIO a zero nel computo)", () => {
    expect(
      numeroPianiAbitativiDalComputo([voceConteggiata({ idMaster: 'solaio-interpiano', importo: 'compresa' })]),
    ).toBe(1)
  })

  it('restituisce 1 se solaio-interpiano vale 0 numerico', () => {
    expect(numeroPianiAbitativiDalComputo([voceConteggiata({ idMaster: 'solaio-interpiano', importo: 0 })])).toBe(1)
  })

  it('restituisce 2 (multipiano) se solaio-interpiano ha un importo numerico positivo', () => {
    expect(
      numeroPianiAbitativiDalComputo([voceConteggiata({ idMaster: 'solaio-interpiano', importo: 15240.96 })]),
    ).toBe(2)
  })

  it('un array vuoto è monopiano', () => {
    expect(numeroPianiAbitativiDalComputo([])).toBe(1)
  })
})
