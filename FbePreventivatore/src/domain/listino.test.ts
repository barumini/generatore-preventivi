import { describe, expect, it } from 'vitest'
import { LISTINO_2026, driverPer, proponiValore } from './listino'
import { CATALOGO_VOCI } from './voci'

describe('LISTINO_2026', () => {
  it('ha un driver per ogni voce prezzabile del catalogo', () => {
    const idPrezzabili = CATALOGO_VOCI.filter((v) => !v.importoTestualeDefault).map((v) => v.id)
    for (const id of idPrezzabili) {
      expect(driverPer(LISTINO_2026, id), `manca il driver per ${id}`).toBeDefined()
    }
  })
})

describe('proponiValore — coerenza con Crivellaro (tolleranza ±5%)', () => {
  const input = {
    superficiLordeTotale: 161,
    superficieGarage: 41,
    perimetro: 60,
    serramenti: { areaLordaTotale: 30.5, numero: 11 },
  }

  it('propone un valore vicino ai 96 100 € reali per le pareti MHM', () => {
    const driver = driverPer(LISTINO_2026, 'pareti-mhm')!
    const proposto = proponiValore(driver, input, new Map())
    expect(proposto).toBeGreaterThan(96100 * 0.95)
    expect(proposto).toBeLessThan(96100 * 1.05)
  })

  it('propone un valore vicino ai 20 000 € reali per il garage (41 mq)', () => {
    const driver = driverPer(LISTINO_2026, 'garage')!
    const proposto = proponiValore(driver, input, new Map())
    expect(proposto).toBeGreaterThan(20000 * 0.95)
    expect(proposto).toBeLessThan(20000 * 1.05)
  })

  it('la consulenza progettazione esecutiva è a corpo fisso 4 000 € indipendentemente dalla geometria', () => {
    const driver = driverPer(LISTINO_2026, 'progettazione-esecutiva')!
    expect(proponiValore(driver, input, new Map())).toBe(4000)
    expect(proponiValore(driver, { ...input, superficiLordeTotale: 300 }, new Map())).toBe(4000)
  })

  it('calcola l\'assistenza cartongessisti come percentuale della voce padre già valorizzata', () => {
    const driver = driverPer(LISTINO_2026, 'assistenza-cartongessisti')!
    const vociValorizzate = new Map([['cartongesso-q2', 15500]])
    const proposto = proponiValore(driver, input, vociValorizzate)
    expect(proposto).toBeCloseTo(15500 * 0.142, 0)
  })
})
