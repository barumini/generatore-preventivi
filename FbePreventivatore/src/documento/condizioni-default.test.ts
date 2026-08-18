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

  it('consegna/validità partono vuote (nessun valore finto plausibile)', () => {
    expect(CONDIZIONI_DEFAULT.consegna).toBe('')
    expect(CONDIZIONI_DEFAULT.validita).toBe('')
  })

  it('caparra parte a 0', () => {
    expect(CONDIZIONI_DEFAULT.caparra).toBe(0)
  })

  it('optional ed esclusioni partono vuoti — un\'offerta può non averne', () => {
    expect(CONDIZIONI_DEFAULT.optional).toEqual([])
    expect(CONDIZIONI_DEFAULT.esclusioni).toEqual([])
  })
})
