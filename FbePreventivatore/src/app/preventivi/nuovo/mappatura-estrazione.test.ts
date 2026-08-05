import { describe, expect, it } from 'vitest'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import type { CampiEstratti } from '@/ai/estrazione'

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
})
