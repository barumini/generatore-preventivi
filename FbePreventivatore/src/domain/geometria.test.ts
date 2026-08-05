import { describe, expect, it } from 'vitest'
import {
  calcolaApertura,
  totaliSerramenti,
  DETRAZIONI_DEFAULT,
  risolviValoreLordo,
  totaleSuperficiLorde,
  superficieGarage,
  numeroPianiAbitativi,
  superficieSedime,
  type Serramento,
  type SuperficiePiano,
} from './geometria'

const SERRAMENTI_CRIVELLARO: Serramento[] = [
  { n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1.0, h: 2.2 },
  { n: 2, piano: 'PT', tipologia: 'finestra', b: 2.0, h: 1.8 },
  { n: 3, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 2.2 },
  { n: 4, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 5, piano: 'PT', tipologia: 'doppia finestra', b: 0.9, h: 1.2 },
  { n: 6, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 7, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 8, piano: 'PT', tipologia: 'finestra', b: 2.6, h: 2.2 },
  { n: 9, piano: 'PT', tipologia: 'finestra', b: 2.8, h: 2.2 },
  { n: 10, piano: 'PT', tipologia: 'portafinestra', b: 2.2, h: 2.2 },
  { n: 11, piano: 'PT', tipologia: 'finestra', b: 0.8, h: 2.1 },
]

describe('calcolaApertura', () => {
  it('calcola area lorda e netta con le detrazioni standard 0,60 x 0,30', () => {
    const risultato = calcolaApertura({ n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1.0, h: 2.2 })
    expect(risultato.areaLorda).toBeCloseTo(2.2, 2)
    expect(risultato.larghezzaNetta).toBeCloseTo(0.4, 2)
    expect(risultato.altezzaNetta).toBeCloseTo(1.9, 2)
    expect(risultato.areaNetta).toBeCloseTo(0.76, 2)
  })

  it('accetta detrazioni personalizzate', () => {
    const risultato = calcolaApertura(
      { n: 1, piano: 'PT', tipologia: 'finestra', b: 1.0, h: 1.0 },
      { orizzontale: 0, verticale: 0 },
    )
    expect(risultato.areaNetta).toBeCloseTo(1.0, 2)
  })
})

describe('totaliSerramenti — golden case Crivellaro', () => {
  it('riproduce 30,50 mq lordi e 15,89 mq netti dal foglio Conteggi pulito.xlsx', () => {
    const { areaLordaTotale, areaNettaTotale, numero } = totaliSerramenti(SERRAMENTI_CRIVELLARO)
    expect(areaLordaTotale).toBeCloseTo(30.5, 2)
    expect(areaNettaTotale).toBeCloseTo(15.89, 2)
    expect(numero).toBe(11)
  })
})

describe('DETRAZIONI_DEFAULT', () => {
  it('vale 0,60 orizzontale e 0,30 verticale', () => {
    expect(DETRAZIONI_DEFAULT).toEqual({ orizzontale: 0.6, verticale: 0.3 })
  })
})

const SUPERFICI_CRIVELLARO: SuperficiePiano[] = [
  { piano: 'Piano Terra', valoreLordo: '134' },
  { piano: 'Portico', valoreLordo: '13+14' },
  { piano: 'Garage', valoreLordo: '41' },
]

describe('risolviValoreLordo', () => {
  it('somma valori concatenati da +', () => {
    expect(risolviValoreLordo('13+14')).toBe(27)
  })

  it('accetta un numero singolo', () => {
    expect(risolviValoreLordo('134')).toBe(134)
  })

  it('tratta la stringa vuota come 0', () => {
    expect(risolviValoreLordo('')).toBe(0)
  })
})

describe('totaleSuperficiLorde — golden case Crivellaro', () => {
  it('somma 134 + 13 + 14 = 161, escludendo il Garage', () => {
    expect(totaleSuperficiLorde(SUPERFICI_CRIVELLARO)).toBe(161)
  })
})

describe('superficieGarage', () => {
  it('estrae il valore della riga Garage separatamente', () => {
    expect(superficieGarage(SUPERFICI_CRIVELLARO)).toBe(41)
  })

  it('vale 0 se non c\'è nessuna riga Garage', () => {
    expect(superficieGarage([{ piano: 'Piano Terra', valoreLordo: '100' }])).toBe(0)
  })
})

describe('numeroPianiAbitativi', () => {
  it('conta solo Piano Terra/Primo/sottotetto con valore positivo — Crivellaro è monopiano', () => {
    expect(numeroPianiAbitativi(SUPERFICI_CRIVELLARO)).toBe(1)
  })

  it('conta due piani se Piano Primo ha un valore', () => {
    const superfici: SuperficiePiano[] = [
      { piano: 'Piano Terra', valoreLordo: '63' },
      { piano: 'Piano Primo', valoreLordo: '63' },
    ]
    expect(numeroPianiAbitativi(superfici)).toBe(2)
  })
})

describe('superficieSedime', () => {
  it('restituisce il valore di Piano Terra come proxy dell\'impronta a terra — golden case Crivellaro', () => {
    expect(superficieSedime(SUPERFICI_CRIVELLARO)).toBe(134)
  })

  it('vale 0 se non c\'è nessuna riga Piano Terra', () => {
    expect(superficieSedime([{ piano: 'Portico', valoreLordo: '13+14' }])).toBe(0)
  })
})
