import { describe, expect, it } from 'vitest'
import { generaAbacoSerramenti, generaAbacoPerCategoria } from './abaco'
import type { Serramento } from '@/domain/geometria'

const SERRAMENTI_CRIVELLARO: Serramento[] = [
  { n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 },
  { n: 2, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.0, h: 1.8 },
  { n: 3, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 2.2 },
  { n: 4, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 5, piano: 'PT', tipologia: 'doppia finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 6, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 7, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 8, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.6, h: 2.2 },
  { n: 9, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.8, h: 2.2 },
  { n: 10, piano: 'PT', tipologia: 'portafinestra', categoria: 'portafinestra-battente', b: 2.2, h: 2.2 },
  { n: 11, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.8, h: 2.1 },
]

describe('generaAbacoSerramenti — golden case Crivellaro', () => {
  it('raggruppa le finestre 0,9x1,2 in un\'unica riga "n. 4 dim. 90x120"', () => {
    const abaco = generaAbacoSerramenti(SERRAMENTI_CRIVELLARO.filter((s) => s.tipologia !== 'porta di ingresso' && s.tipologia !== 'portafinestra'))
    expect(abaco).toContain('n. 4 dim. 90x120')
  })

  it('elenca le dimensioni non ripetute singolarmente', () => {
    const abaco = generaAbacoSerramenti(SERRAMENTI_CRIVELLARO.filter((s) => s.tipologia === 'finestra' && s.b === 2.0))
    expect(abaco).toContain('n. 1 dim. 200x180')
  })

  it('tratta separatamente il portoncino di ingresso', () => {
    const porta = SERRAMENTI_CRIVELLARO.find((s) => s.tipologia === 'porta di ingresso')!
    const abaco = generaAbacoSerramenti([porta], { prefisso: 'n. {n} portoncini di ingresso dim. standard {dim}' })
    expect(abaco).toBe('n. 1 portoncini di ingresso dim. standard 100x220')
  })
})

describe('generaAbacoPerCategoria — golden case Crivellaro', () => {
  it('smista il portoncino solo nella categoria portoncini', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.portoncini).toBe('n. 1 dim. 100x220;')
    expect(abaco.finestreBattente).not.toContain('100x220')
  })

  it('smista la portafinestra nella categoria portefinestreBattente', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.portefinestreBattente).toBe('n. 1 dim. 220x220;')
  })

  it('lascia vuote le categorie senza serramenti (fissi e scorrevoli, assenti in Crivellaro)', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.fissiVetrate).toBe('')
    expect(abaco.alzantiScorrevoli).toBe('')
  })

  it('tutti resta identico all\'output esistente di generaAbacoSerramenti', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.tutti).toBe(generaAbacoSerramenti(SERRAMENTI_CRIVELLARO))
  })
})
