import { describe, expect, it } from 'vitest'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import type { CampiEstratti } from '@/ai/estrazione'
import { superficieGarage, superficieSedime } from '@/domain/geometria'

describe('statoFormDaCampiEstratti', () => {
  it('mappa i campi estratti nella forma attesa da StatoForm', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      superfici: [{ piano: 'Piano Terra', valoreLordo: '134' }],
      tipoCopertura: 'falde',
      finituraEsterna: 'intonaco',
      pacchetto: 'grezzo avanzato',
      campiMancanti: ['progettista'],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.cliente).toEqual({ nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' })
    expect(parziale.protocollo).toBe('2026059')
    expect(parziale.superfici).toEqual([{ piano: 'Piano Terra', valoreLordo: '134' }])
  })

  it("non imposta campi non presenti nell'estrazione, lasciandoli da compilare nel form", () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Solo Nome' },
      superfici: [],
      campiMancanti: ['comune', 'protocollo'],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.protocollo).toBeUndefined()
  })

  it('normalizza i nomi piano estratti nella forma canonica che il dominio confronta', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Test' },
      superfici: [
        { piano: 'Piano terra', valoreLordo: '134' },
        { piano: 'garage', valoreLordo: '41' },
        { piano: '  Portico ', valoreLordo: '13+14' },
      ],
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).superfici).toEqual([
      { piano: 'Piano Terra', valoreLordo: '134' },
      { piano: 'Garage', valoreLordo: '41' },
      { piano: 'Portico', valoreLordo: '13+14' },
    ])
  })

  it('lascia invariato un piano non riconosciuto, così l\'operatore lo vede e lo corregge', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Test' },
      superfici: [{ piano: 'Mansarda', valoreLordo: '30' }],
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).superfici).toEqual([{ piano: 'Mansarda', valoreLordo: '30' }])
  })

  it('un piano normalizzato entra correttamente nel calcolo, uno grezzo no', () => {
    const grezzi: CampiEstratti = {
      cliente: { nome: 'Test' },
      superfici: [
        { piano: 'piano terra', valoreLordo: '134' },
        { piano: 'box auto', valoreLordo: '41' },
      ],
      campiMancanti: [],
    }

    const superfici = statoFormDaCampiEstratti(grezzi).superfici!
    // 'piano terra' recuperato → il sedime alimenta il driver della copertura;
    // 'box auto' non è un nome canonico → resta fuori, e resta visibile nel form.
    expect(superficieSedime(superfici)).toBe(134)
    expect(superficieGarage(superfici)).toBe(0)
    expect(superfici[1].piano).toBe('box auto')
  })
})
