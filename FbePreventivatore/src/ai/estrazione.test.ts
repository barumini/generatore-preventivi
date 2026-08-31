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

  it('accetta progettista e luogo quando presenti nella risposta', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Rossi' },
      superfici: [],
      progettista: 'Mario Rossi',
      luogo: 'Bassano del Grappa',
      campiMancanti: [],
    })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.progettista).toBe('Mario Rossi')
    expect(campi.luogo).toBe('Bassano del Grappa')
  })

  it('accetta una risposta senza progettista né luogo (entrambi opzionali)', async () => {
    const risposta = JSON.stringify({ cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.progettista).toBeUndefined()
    expect(campi.luogo).toBeUndefined()
  })

  it('lancia un errore leggibile se il client risponde con JSON malformato', async () => {
    await expect(estraiCampi('testo qualsiasi', clienteFinto('non è json'))).rejects.toThrow(/estrazione/i)
  })

  it('lancia un errore se manca un campo obbligatorio nella risposta', async () => {
    // cliente.nome è l'unico campo davvero obbligatorio dello schema: qui è assente.
    const rispostaIncompleta = JSON.stringify({ cliente: { comune: 'Trissino' } })
    await expect(estraiCampi('testo qualsiasi', clienteFinto(rispostaIncompleta))).rejects.toThrow()
  })

  it('accetta pareti, falde e travi quando presenti nella risposta', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Rossi' },
      superfici: [],
      pareti: [{ n: 1, tipo: 'E', b: 12.5, h: 2.7, spessore: 20 }],
      falde: [{ etichetta: 'Una falda', notazione: '5,8x16,5 x17,1' }],
      travi: [{ etichetta: 'Colmo', notazione: '16,5x0,2x0,32' }],
      campiMancanti: [],
    })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.pareti).toEqual([{ n: 1, tipo: 'E', b: 12.5, h: 2.7, spessore: 20 }])
    expect(campi.falde).toEqual([{ etichetta: 'Una falda', notazione: '5,8x16,5 x17,1' }])
    expect(campi.travi).toEqual([{ etichetta: 'Colmo', notazione: '16,5x0,2x0,32' }])
  })

  it('accetta una risposta senza pareti/falde/travi (tutti opzionali)', async () => {
    const risposta = JSON.stringify({ cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.pareti).toBeUndefined()
    expect(campi.falde).toBeUndefined()
    expect(campi.travi).toBeUndefined()
  })

  it('accetta serramenti quando presenti nella risposta', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Rossi' },
      superfici: [],
      serramenti: [
        { n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 },
        { n: 2, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.0, h: 1.8 },
      ],
      campiMancanti: [],
    })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.serramenti).toEqual([
      { n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 },
      { n: 2, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.0, h: 1.8 },
    ])
  })

  it('accetta una risposta senza serramenti (opzionale)', async () => {
    const risposta = JSON.stringify({ cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.serramenti).toBeUndefined()
  })

  it('rifiuta un serramento con categoria non tra quelle ammesse', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Rossi' },
      superfici: [],
      serramenti: [{ n: 1, piano: 'PT', tipologia: 'oblò', categoria: 'oblo-rotondo', b: 0.5, h: 0.5 }],
      campiMancanti: [],
    })

    await expect(estraiCampi('testo qualsiasi', clienteFinto(risposta))).rejects.toThrow()
  })

  it('accetta gli spessori come testo libero, anche composito', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Rossi' },
      superfici: [],
      spessoreEsterno: '205-160',
      spessoreInterno: '160',
      spessoreCoibente: '200',
      spessoreCappotto: '60+40',
      campiMancanti: [],
    })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.spessoreEsterno).toBe('205-160')
    expect(campi.spessoreInterno).toBe('160')
    expect(campi.spessoreCoibente).toBe('200')
    expect(campi.spessoreCappotto).toBe('60+40')
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
    vi.stubEnv('LM_STUDIO_BASE_URL', undefined)
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
