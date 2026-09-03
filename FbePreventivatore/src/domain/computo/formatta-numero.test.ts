import { describe, expect, it } from 'vitest'
import { numeroIt, quantitaIt } from './formatta-numero'

describe('numeroIt', () => {
  it('usa lo spazio per le migliaia e la virgola decimale', () => {
    expect(numeroIt(68_428.78)).toBe('68 428,78')
    expect(numeroIt(105_987.63)).toBe('105 987,63')
    expect(numeroIt(220, 0)).toBe('220')
  })
})

describe('quantitaIt', () => {
  it('omette i decimali sugli interi', () => {
    expect(quantitaIt(14)).toBe('14')
    expect(quantitaIt(184.18)).toBe('184,18')
  })
})
