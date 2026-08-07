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

// aggiunta a src/ai/estrazione.test.ts
import { afterEach, vi } from 'vitest'
import { ClienteEstrazioneLMStudio } from './estrazione'

describe('ClienteEstrazioneLMStudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('costruisce la richiesta HTTP verso l\'endpoint di default e restituisce il testo della risposta', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'qwen2.5-7b-instruct')
    const fetchFinto = vi.fn(async (url: string, opzioni: RequestInit) => {
      expect(url).toBe('http://localhost:1234/v1/chat/completions')
      const corpo = JSON.parse(opzioni.body as string)
      expect(corpo.model).toBe('qwen2.5-7b-instruct')
      expect(corpo.temperature).toBe(0.1)
      expect(corpo.messages).toEqual([
        { role: 'system', content: expect.any(String) },
        { role: 'user', content: 'casa per Rossi a Vicenza' },
      ])
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"cliente":{"nome":"Rossi"}}' } }] }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchFinto)

    const cliente = new ClienteEstrazioneLMStudio()
    const risultato = await cliente.estrai('casa per Rossi a Vicenza')

    expect(risultato).toBe('{"cliente":{"nome":"Rossi"}}')
    expect(fetchFinto).toHaveBeenCalledTimes(1)
  })

  it('usa LM_STUDIO_BASE_URL personalizzato quando impostato', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubEnv('LM_STUDIO_BASE_URL', 'http://192.168.1.50:1234/v1')
    const fetchFinto = vi.fn(async (url: string) => {
      expect(url).toBe('http://192.168.1.50:1234/v1/chat/completions')
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFinto)

    await new ClienteEstrazioneLMStudio().estrai('testo')

    expect(fetchFinto).toHaveBeenCalledTimes(1)
  })

  it('lancia un errore leggibile se LM Studio non è raggiungibile', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed')
      }),
    )

    const cliente = new ClienteEstrazioneLMStudio()
    await expect(cliente.estrai('testo')).rejects.toThrow(/LM Studio.*in esecuzione/)
  })

  it('lancia un errore leggibile se LM Studio risponde con uno stato di errore', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-inesistente')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('modello non trovato', { status: 404 })))

    const cliente = new ClienteEstrazioneLMStudio()
    await expect(cliente.estrai('testo')).rejects.toThrow(/404/)
  })

  it('lancia un errore leggibile se LM Studio risponde 200 con un corpo non-JSON', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('non è json', { status: 200 })))

    const cliente = new ClienteEstrazioneLMStudio()
    await expect(cliente.estrai('testo')).rejects.toThrow(/Estrazione fallita/)
  })

  it('lancia un errore se LM_STUDIO_MODEL non è impostata', () => {
    vi.stubEnv('LM_STUDIO_MODEL', undefined)
    expect(() => new ClienteEstrazioneLMStudio()).toThrow(/LM_STUDIO_MODEL/)
  })
})
