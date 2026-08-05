// src/domain/voci.test.ts
import { describe, expect, it } from 'vitest'
import { CATALOGO_VOCI, voceInclusa, vociIncluse, numeraVoci, type ConfigurazioneVoci } from './voci'

const CONFIG_CRIVELLARO: ConfigurazioneVoci = {
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  numeroPianiAbitativi: 1,
  superficieGarage: 41,
  chiaviInManoNelTotale: true,
}

describe('voceInclusa', () => {
  it('include il solaio interpiano solo se ci sono più piani', () => {
    const solaio = CATALOGO_VOCI.find((v) => v.id === 'solaio-interpiano')!
    expect(voceInclusa(solaio, CONFIG_CRIVELLARO)).toBe(false)
    expect(voceInclusa(solaio, { ...CONFIG_CRIVELLARO, numeroPianiAbitativi: 2 })).toBe(true)
  })

  it('esclude il cappotto se il modulo involucro è impoverito', () => {
    const cappotto = CATALOGO_VOCI.find((v) => v.id === 'cappotto')!
    expect(voceInclusa(cappotto, { ...CONFIG_CRIVELLARO, livelli: { ...CONFIG_CRIVELLARO.livelli, involucro: 'impoverito' } })).toBe(false)
    expect(voceInclusa(cappotto, CONFIG_CRIVELLARO)).toBe(true)
  })

  it('include il garage solo se la superficie garage è positiva', () => {
    const garage = CATALOGO_VOCI.find((v) => v.id === 'garage')!
    expect(voceInclusa(garage, CONFIG_CRIVELLARO)).toBe(true)
    expect(voceInclusa(garage, { ...CONFIG_CRIVELLARO, superficieGarage: 0 })).toBe(false)
  })

  it('include le opere chiavi in mano solo se finiture non è già completo e flag è true', () => {
    const chiaviInMano = CATALOGO_VOCI.find((v) => v.id === 'opere-chiavi-in-mano')!
    expect(voceInclusa(chiaviInMano, CONFIG_CRIVELLARO)).toBe(true)
    expect(
      voceInclusa(chiaviInMano, { ...CONFIG_CRIVELLARO, livelli: { ...CONFIG_CRIVELLARO.livelli, finiture: 'completo' } }),
    ).toBe(false)
  })

  it('esclude opere-chiavi-in-mano se chiaviInManoNelTotale è false, anche con finiture impoverito', () => {
    const chiaviInMano = CATALOGO_VOCI.find((v) => v.id === 'opere-chiavi-in-mano')!
    expect(voceInclusa(chiaviInMano, { ...CONFIG_CRIVELLARO, chiaviInManoNelTotale: false })).toBe(false)
  })
})

describe('vociIncluse + numeraVoci — golden case Crivellaro', () => {
  it('riproduce esattamente la numerazione 1,1.a,1.b,1.c,2,3,4,4.a,5,5.a,6,7,8', () => {
    const incluse = vociIncluse(CATALOGO_VOCI, CONFIG_CRIVELLARO)
    const numerate = numeraVoci(incluse)
    expect(numerate.map((v) => v.numero)).toEqual([
      '1', '1.a', '1.b', '1.c', '2', '3', '4', '4.a', '5', '5.a', '6', '7', '8',
    ])
    expect(numerate.map((v) => v.voce.id)).toEqual([
      'pareti-mhm',
      'tracciamento-impianti',
      'pareti-telaio',
      'trave-larice',
      'copertura-falda',
      'cappotto',
      'cartongesso-q2',
      'assistenza-cartongessisti',
      'infissi-pvc',
      'monoblocchi',
      'progettazione-esecutiva',
      'opere-chiavi-in-mano',
      'garage',
    ])
  })

  it('esclude il solaio interpiano dalla numerazione se monopiano', () => {
    const incluse = vociIncluse(CATALOGO_VOCI, CONFIG_CRIVELLARO)
    expect(incluse.find((v) => v.id === 'solaio-interpiano')).toBeUndefined()
  })
})
