import { describe, expect, it } from 'vitest'
import type { CampiEstratti } from './estrazione'
import { CASI_VALUTAZIONE, valutaCaso } from './valutazione-estrazione'

const BASE: CampiEstratti = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  progettista: 'arch. Paolo Bianchi',
  luogo: 'Trissino',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  tipoCopertura: 'falde',
  finituraEsterna: 'intonaco',
  pacchetto: 'grezzo avanzato',
  spessoreEsterno: '205',
  spessoreInterno: '160',
  spessoreCoibente: '200',
  spessoreCappotto: '140',
  campiMancanti: [],
}

const IDEALI: Record<string, CampiEstratti> = {
  completo: BASE,
  'senza-protocollo': { ...BASE, protocollo: undefined, campiMancanti: ['protocollo'] },
  'finestra-senza-altezza': {
    ...BASE,
    serramenti: [{ n: 1, piano: 'Piano Terra', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1, h: 2.2 }],
  },
}

function caso(id: string) {
  const trovato = CASI_VALUTAZIONE.find((c) => c.id === id)
  if (!trovato) throw new Error(`caso ${id} assente`)
  return trovato
}

function bocciati(id: string, campi: CampiEstratti | null): string[] {
  return valutaCaso(caso(id), campi)
    .filter((e) => !e.superato)
    .map((e) => e.controllo)
}

describe('CASI_VALUTAZIONE', () => {
  it('ogni caso supera tutti i controlli con la risposta ideale', () => {
    for (const c of CASI_VALUTAZIONE) {
      expect(bocciati(c.id, IDEALI[c.id]), c.id).toEqual([])
    }
  })

  it('conta 26 controlli per ripetizione', () => {
    expect(CASI_VALUTAZIONE.reduce((n, c) => n + c.controlli.length, 0)).toBe(26)
  })

  it('boccia un protocollo inventato e non segnalato', () => {
    expect(bocciati('senza-protocollo', { ...BASE, protocollo: '2026001' })).toEqual([
      'protocollo non inventato',
      'protocollo segnalato mancante',
    ])
  })

  it('boccia una finestra con altezza inventata', () => {
    const campi: CampiEstratti = {
      ...IDEALI['finestra-senza-altezza'],
      serramenti: [
        ...IDEALI['finestra-senza-altezza'].serramenti!,
        { n: 2, piano: 'Piano Terra', tipologia: 'finestra', categoria: 'finestra-battente', b: 2, h: 1.8 },
      ],
    }
    expect(bocciati('finestra-senza-altezza', campi)).toEqual(['finestra senza altezza omessa', 'un solo serramento'])
  })

  it('ignora "luogo" tra i campi mancanti, come fa la chat', () => {
    expect(bocciati('completo', { ...BASE, campiMancanti: ['luogo'] })).toEqual([])
  })

  it('boccia un piano non canonico e una superficie scritta in forma diversa', () => {
    const campi: CampiEstratti = {
      ...BASE,
      superfici: [
        { piano: 'piano terra', valoreLordo: '134' },
        { piano: 'Portico', valoreLordo: '27' },
        { piano: 'Garage', valoreLordo: '41' },
      ],
    }
    expect(bocciati('completo', campi)).toEqual(['superfici canoniche, forma scritta conservata'])
  })

  it("boccia tutto il caso quando l'estrazione fallisce", () => {
    expect(bocciati('completo', null)).toHaveLength(caso('completo').controlli.length)
  })
})
