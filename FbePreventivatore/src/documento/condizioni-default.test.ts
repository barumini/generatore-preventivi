import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creaCondizioniDefault, SAL_DEFAULT } from './condizioni-default'

describe('creaCondizioniDefault', () => {
  it('precompila sal da SAL_DEFAULT, rinominando milestone in descrizione', () => {
    expect(creaCondizioniDefault().sal).toEqual(SAL_DEFAULT.map((s) => ({ percentuale: s.percentuale, descrizione: s.milestone })))
  })

  it('le percentuali di sal sommano a 100', () => {
    const somma = creaCondizioniDefault().sal.reduce((tot, s) => tot + s.percentuale, 0)
    expect(somma).toBeCloseTo(1, 5)
  })

  it('consegna/caparra partono dai valori del golden case Crivellaro', () => {
    expect(creaCondizioniDefault().consegna).toBe('da pattuire')
    expect(creaCondizioniDefault().caparra).toBe(30000)
  })

  it('optional precompila la riga obbligatoria di pratica Genio Civile', () => {
    const condizioni = creaCondizioniDefault()
    expect(condizioni.optional).toHaveLength(1)
    expect(condizioni.optional[0].praticaGenioCivile).toBe(true)
  })

  it('esclusioni precompila l\'esclusione standard dell\'operaio specializzato', () => {
    expect(creaCondizioniDefault().esclusioni).toEqual([{ descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' }])
  })

  it('due chiamate non condividono lo stesso array mutabile', () => {
    const a = creaCondizioniDefault()
    const b = creaCondizioniDefault()
    expect(a.sal).not.toBe(b.sal)
    expect(a.optional).not.toBe(b.optional)
    expect(a.esclusioni).not.toBe(b.esclusioni)
  })

  describe('validita', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('è oggi + 30 giorni, formattata gg.mm.aaaa', () => {
      vi.setSystemTime(new Date(2026, 0, 15)) // 15 gennaio 2026, fuso locale
      expect(creaCondizioniDefault().validita).toBe('14.02.2026')
    })

    it('attraversa correttamente il cambio di anno', () => {
      vi.setSystemTime(new Date(2026, 11, 15)) // 15 dicembre 2026
      expect(creaCondizioniDefault().validita).toBe('14.01.2027')
    })
  })
})
