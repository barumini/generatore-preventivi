import { describe, expect, it } from 'vitest'
import { generaProtocolloBozza } from './protocollo-bozza'
import { isProtocolloPlaceholder } from '@/ai/coerenza'

describe('generaProtocolloBozza', () => {
  it('genera un codice nel formato BOZZA-<anno>-<5 cifre>', () => {
    const codice = generaProtocolloBozza(new Date('2026-09-23'))
    expect(codice).toMatch(/^BOZZA-2026-\d{5}$/)
  })

  it('usa l\'anno corrente quando non viene passata una data', () => {
    const codice = generaProtocolloBozza()
    expect(codice).toMatch(new RegExp(`^BOZZA-${new Date().getFullYear()}-\\d{5}$`))
  })

  it('il codice generato è riconosciuto come placeholder dal guardrail di coerenza', () => {
    expect(isProtocolloPlaceholder(generaProtocolloBozza())).toBe(true)
  })
})
