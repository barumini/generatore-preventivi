import { describe, expect, it } from 'vitest'
import { estraiComputo } from './estrai-voci'
import {
  regolaParetiBase,
  regolaTraveBase,
  regolaSolaio,
  regolaConsulenza,
  TARIFFE_TRAVE_BASE,
} from './regole-conteggio'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])

describe('regolaParetiBase', () => {
  it('legge la categoria PARETI IN LEGNO', () => {
    expect(regolaParetiBase(dacroce).importo).toBe(105_987.63)
    expect(regolaParetiBase(crivellaro).importo).toBe(79_500.82)
  })

  it('dichiara la provenienza e la sorgente', () => {
    const voce = regolaParetiBase(dacroce)
    expect(voce.idMaster).toBe('pareti-mhm')
    expect(voce.provenienza).toBe('calcolato')
    expect(voce.passaggi[0].origine.categoria).toBe('M:001.001')
  })
})

describe('regolaTraveBase', () => {
  it('somma le undici tariffe dell’assieme di base', () => {
    expect(regolaTraveBase(dacroce).importo).toBe(10_104.24)
    expect(regolaTraveBase(crivellaro).importo).toBe(5_843.70)
  })

  it('esclude la posa cordolo 104.01.024', () => {
    expect(TARIFFE_TRAVE_BASE).not.toContain('104.01.024')
    expect(TARIFFE_TRAVE_BASE).toHaveLength(11)
  })

  it('mostra un passaggio per ogni tariffa che contribuisce', () => {
    const voce = regolaTraveBase(dacroce)
    expect(voce.passaggi).toHaveLength(11)
    expect(voce.passaggi.map((p) => p.origine.tariffa)).toEqual([...TARIFFE_TRAVE_BASE])
  })
})

describe('regolaSolaio', () => {
  it('legge la categoria SOLAIO', () => {
    expect(regolaSolaio(dacroce).importo).toBe(15_240.96)
  })

  it("diventa 'compresa' quando la categoria vale zero", () => {
    expect(regolaSolaio(crivellaro).importo).toBe('compresa')
  })
})

describe('regolaConsulenza', () => {
  it('vale sempre 4.000 e non dipende dal computo', () => {
    const voce = regolaConsulenza()
    expect(voce.importo).toBe(4_000)
    expect(voce.provenienza).toBe('fisso')
    expect(voce.passaggi).toEqual([])
  })
})

describe('trasparenza delle formule', () => {
  it('le formule portano i valori, non i codici categoria', () => {
    for (const voce of [regolaParetiBase(dacroce), regolaSolaio(dacroce), regolaTraveBase(dacroce)]) {
      expect(voce.formula).not.toMatch(/M:001\.\d{3}/)
    }
    expect(regolaParetiBase(dacroce).formula).toContain('105 987,63')
  })
})
