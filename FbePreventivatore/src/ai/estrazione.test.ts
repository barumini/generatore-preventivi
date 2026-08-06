import { describe, expect, it } from 'vitest'
import { estraiCampi, PROMPT_SISTEMA, type ClienteEstrazione } from './estrazione'
import { PIANI_CANONICI } from '@/domain/geometria'

function clienteFinto(rispostaJson: string): ClienteEstrazione {
  return {
    async estrai() {
      return rispostaJson
    },
  }
}

describe('estraiCampi', () => {
  it('valida e restituisce i campi quando il client risponde con JSON corretto', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      superfici: [{ piano: 'Piano Terra', valoreLordo: '134' }],
      tipoCopertura: 'falde',
      finituraEsterna: 'intonaco',
      pacchetto: 'grezzo avanzato',
      campiMancanti: ['progettista', 'serramenti'],
    })

    const campi = await estraiCampi('casa per Crivellaro Mariano a Trissino...', clienteFinto(risposta))

    expect(campi.cliente.nome).toBe('Crivellaro Mariano')
    expect(campi.protocollo).toBe('2026059')
    expect(campi.superfici).toEqual([{ piano: 'Piano Terra', valoreLordo: '134' }])
    expect(campi.campiMancanti).toContain('progettista')
  })

  it('lancia un errore leggibile se il client risponde con JSON malformato', async () => {
    await expect(estraiCampi('testo qualsiasi', clienteFinto('non è json'))).rejects.toThrow(/estrazione/i)
  })

  it('lancia un errore se manca un campo obbligatorio nella risposta', async () => {
    // cliente.nome è l'unico campo davvero obbligatorio dello schema: qui è assente.
    const rispostaIncompleta = JSON.stringify({ cliente: { comune: 'Trissino' } })
    await expect(estraiCampi('testo qualsiasi', clienteFinto(rispostaIncompleta))).rejects.toThrow()
  })
})

describe('PROMPT_SISTEMA', () => {
  it('enumera esplicitamente i nomi piano canonici, così il modello non inventa varianti', () => {
    for (const nome of PIANI_CANONICI) {
      expect(PROMPT_SISTEMA).toContain(`"${nome}"`)
    }
  })

  it('istruisce a non scartare un piano non riconosciuto', () => {
    expect(PROMPT_SISTEMA).toMatch(/campiMancanti/)
  })
})
