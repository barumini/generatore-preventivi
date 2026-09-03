import { describe, expect, it } from 'vitest'
import dacroce from './fixtures/dacroce.json'
import crivellaro from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const CASI: Array<[string, FrammentoTesto[], number]> = [
  ['dacroce', dacroce as FrammentoTesto[], 2625],
  ['crivellaro', crivellaro as FrammentoTesto[], 2659],
]

describe('fixture dei computi reali', () => {
  it.each(CASI)('%s ha il numero di frammenti attesi', (_nome, frammenti, attesi) => {
    expect(frammenti).toHaveLength(attesi)
  })

  it.each(CASI)('%s copre 25 pagine e non ha frammenti vuoti', (_nome, frammenti) => {
    expect(Math.max(...frammenti.map((f) => f.pagina))).toBe(25)
    expect(frammenti.every((f) => f.testo.trim().length > 0)).toBe(true)
  })

  it('conserva la griglia di Primus: la riga SOMMANO porta i numeri in colonne distinte', () => {
    const frammenti = dacroce as FrammentoTesto[]
    // L'ordine di getTextContent() non è garantito y-decrescente: si sceglie il
    // frammento SOMMANO con y massima (la riga più in alto di pagina 2), che è
    // deterministico, invece del primo trovato nell'array.
    const candidatiSommano = frammenti.filter(
      (f) => f.pagina === 2 && f.testo.startsWith('SOMMANO'),
    )
    expect(candidatiSommano.length).toBeGreaterThan(0)
    const sommano = candidatiSommano.reduce((max, f) => (f.y > max.y ? f : max))
    const stessaRiga = frammenti
      .filter((f) => f.pagina === 2 && Math.abs(f.y - sommano.y) <= 2)
      .sort((a, b) => a.x - b.x)
    // quantità ~x460, prezzo unitario ~x504, totale ~x562
    expect(stessaRiga.map((f) => f.testo)).toEqual(['SOMMANO m', '0,00', '4,29', '0,00'])
  })
})
