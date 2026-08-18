import { describe, expect, it } from 'vitest'
import { formattaDataItaliana } from './formatta-data-italiana'

describe('formattaDataItaliana', () => {
  it('formatta una data ISO con mese in lettere e luogo davanti, come nel master (pag. 4)', () => {
    expect(formattaDataItaliana('2026-08-06', 'Castelgomberto')).toBe('Castelgomberto, 6 agosto 2026')
  })

  it('non aggiunge lo zero iniziale al giorno', () => {
    expect(formattaDataItaliana('2026-01-01', 'Trissino')).toBe('Trissino, 1 gennaio 2026')
  })

  it('copre tutti e 12 i mesi', () => {
    const mesi = [
      ['2026-01-15', 'gennaio'], ['2026-02-15', 'febbraio'], ['2026-03-15', 'marzo'],
      ['2026-04-15', 'aprile'], ['2026-05-15', 'maggio'], ['2026-06-15', 'giugno'],
      ['2026-07-15', 'luglio'], ['2026-08-15', 'agosto'], ['2026-09-15', 'settembre'],
      ['2026-10-15', 'ottobre'], ['2026-11-15', 'novembre'], ['2026-12-15', 'dicembre'],
    ] as const
    for (const [iso, nomeMese] of mesi) {
      expect(formattaDataItaliana(iso, 'Vicenza')).toBe(`Vicenza, 15 ${nomeMese} 2026`)
    }
  })

  it('conserva l\'anno esatto', () => {
    expect(formattaDataItaliana('2031-12-31', 'Roma')).toBe('Roma, 31 dicembre 2031')
  })
})
