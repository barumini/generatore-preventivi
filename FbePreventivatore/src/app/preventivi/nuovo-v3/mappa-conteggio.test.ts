import { describe, expect, it } from 'vitest'
import { mappaConteggioAOverride } from './mappa-conteggio'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'

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

describe('mappaConteggioAOverride', () => {
  it('scrive un override numerico per una voce presente nel catalogo', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 127543.28 })],
      {},
    )
    expect(esito.overrides['pareti-mhm']).toBe(127543.28)
    expect(esito.vociScartate).toEqual([])
  })

  it("converte l'importo 'compresa' del conteggio in 'comprese' del wizard", () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'solaio-interpiano', importo: 'compresa' })],
      {},
    )
    expect(esito.overrides['solaio-interpiano']).toBe('comprese')
  })

  it('non sovrascrive un override già presente per una voce che il conteggio non tocca', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 })],
      { garage: 12000 },
    )
    expect(esito.overrides.garage).toBe(12000)
    expect(esito.overrides['pareti-mhm']).toBe(100000)
  })

  it('scarta le voci del conteggio senza corrispondenza nel catalogo attuale', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'copertura-piana', importo: 'compresa' })],
      {},
    )
    expect(esito.overrides['copertura-piana']).toBeUndefined()
    expect(esito.vociScartate).toEqual(['copertura-piana'])
  })

  it('un conteggio più recente sovrascrive un override scritto da un conteggio precedente', () => {
    const primo = mappaConteggioAOverride([voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 })], {})
    const secondo = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 105000 })],
      primo.overrides,
    )
    expect(secondo.overrides['pareti-mhm']).toBe(105000)
  })
})
