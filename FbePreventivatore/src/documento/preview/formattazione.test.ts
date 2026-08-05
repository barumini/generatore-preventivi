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

  it('formatta un valore negativo mantenendo il segno davanti alla cifra', () => {
    // risolviArrotondamento (src/domain/calcolo.ts) puo' restituire un arrotondamento
    // negativo: i chiamanti (es. PaginaPrezzi) devono gestire il segno da soli — qui si
    // blocca solo il comportamento della funzione di formattazione su un numero negativo.
    expect(formattaImportoItaliano(-1070)).toBe('-1 070,00 €')
  })
})
