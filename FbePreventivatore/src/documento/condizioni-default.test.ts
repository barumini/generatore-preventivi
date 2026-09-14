import { describe, expect, it } from 'vitest'
import { CONDIZIONI_DEFAULT, SAL_DEFAULT } from './condizioni-default'

describe('CONDIZIONI_DEFAULT', () => {
  it('precompila sal da SAL_DEFAULT, rinominando milestone in descrizione', () => {
    expect(CONDIZIONI_DEFAULT.sal).toEqual(SAL_DEFAULT.map((s) => ({ percentuale: s.percentuale, descrizione: s.milestone })))
  })

  it('le percentuali di sal sommano a 100', () => {
    const somma = CONDIZIONI_DEFAULT.sal.reduce((tot, s) => tot + s.percentuale, 0)
    expect(somma).toBeCloseTo(1, 5)
  })

  it('consegna/caparra/validità partono dai valori del golden case Crivellaro', () => {
    expect(CONDIZIONI_DEFAULT.consegna).toBe('da pattuire')
    expect(CONDIZIONI_DEFAULT.caparra).toBe(30000)
    expect(CONDIZIONI_DEFAULT.validita).toBe('31.08.2026')
  })

  it('optional precompila la riga obbligatoria di pratica Genio Civile', () => {
    expect(CONDIZIONI_DEFAULT.optional).toHaveLength(1)
    expect(CONDIZIONI_DEFAULT.optional[0].praticaGenioCivile).toBe(true)
  })

  it('esclusioni precompila l\'esclusione standard dell\'operaio specializzato', () => {
    expect(CONDIZIONI_DEFAULT.esclusioni).toEqual([{ descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' }])
  })
})
