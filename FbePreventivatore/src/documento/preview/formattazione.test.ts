import { describe, expect, it } from 'vitest'
import { formattaImportoItaliano } from './formattazione'

describe('formattaImportoItaliano', () => {
  it('formatta 96100 come "96 100,00 €"', () => {
    expect(formattaImportoItaliano(96100)).toBe('96 100,00 €')
  })

  it('formatta 300000 come "300 000,00 €"', () => {
    expect(formattaImportoItaliano(300000)).toBe('300 000,00 €')
  })

  it('lascia passare invariati i valori testuali', () => {
    expect(formattaImportoItaliano('comprese')).toBe('comprese')
    expect(formattaImportoItaliano('OMAGGIO')).toBe('OMAGGIO')
  })
})
