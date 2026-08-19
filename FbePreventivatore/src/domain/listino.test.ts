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

describe('proponiValore — coerenza con Crivellaro (valori esatti)', () => {
  const input = {
    superficiLordeTotale: 161,
    superficieGarage: 41,
    superficieSedime: 134,
    perimetro: 60,
    serramenti: { areaLordaTotale: 30.5, numero: 11 },
  }

  it('propone 96 117,00 € per le pareti MHM (597 €/mq × 161 mq)', () => {
    const driver = driverPer(LISTINO_2026, 'pareti-mhm')!
    expect(proponiValore(driver, input, new Map())).toBe(96117)
  })

  it('propone 20 008,00 € per il garage (488 €/mq × 41 mq)', () => {
    const driver = driverPer(LISTINO_2026, 'garage')!
    expect(proponiValore(driver, input, new Map())).toBe(20008)
  })

  it('propone 63 650,00 € per la copertura, usando l\'impronta a terra (475 €/mq × 134 mq)', () => {
    const driver = driverPer(LISTINO_2026, 'copertura-falda')!
    expect(proponiValore(driver, input, new Map())).toBe(63650)
  })

  it('la consulenza progettazione esecutiva è a corpo fisso 4 000 € indipendentemente dalla geometria', () => {
    const driver = driverPer(LISTINO_2026, 'progettazione-esecutiva')!
    expect(proponiValore(driver, input, new Map())).toBe(4000)
    expect(proponiValore(driver, { ...input, superficiLordeTotale: 300 }, new Map())).toBe(4000)
  })

  it('calcola l\'assistenza cartongessisti come percentuale esatta della voce padre già valorizzata', () => {
    const driver = driverPer(LISTINO_2026, 'assistenza-cartongessisti')!
    const vociValorizzate = new Map([['cartongesso-q2', 15500]])
    expect(proponiValore(driver, input, vociValorizzate)).toBe(2201)
  })
})
