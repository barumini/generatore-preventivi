import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  ClienteEstrazioneLMStudio,
  ClienteEstrazioneOpenRouter,
  creaClienteEstrazione,
  estraiCampi,
  messaggiEstrazione,
  messaggioUnico,
  MODELLI_OPENROUTER_DEFAULT,
  PROMPT_SISTEMA,
  type ClienteEstrazione,
  type MessaggioChat,
} from './estrazione'
import { CHIAVI_ATTESE, controllaForma } from './normalizzazione-estrazione'
import { PIANI_CANONICI } from '@/domain/geometria'

const TESTO = `Preventivo per il cliente Crivellaro Mariano, comune di Trissino, provincia VI.
Protocollo 2026059. Progettista: arch. Paolo Bianchi.
Superfici: Piano Terra 134 mq, Portico 13+14 mq, Garage 41 mq.
Copertura a falde, finitura esterna a intonaco. Pacchetto grezzo avanzato.
Spessori: esterno 205 mm, interno 160 mm, coibente 200 mm, cappotto 140 mm.`

const RISPOSTA = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  progettista: 'arch. Paolo Bianchi',
  luogo: null,
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  tipoCopertura: 'falde',
  finituraEsterna: 'intonaco',
  pacchetto: 'grezzo avanzato',
  spessoreEsterno: '205',
  spessoreInterno: '160',
  spessoreCoibente: '200',
  spessoreCappotto: '140',
  pareti: [],
  falde: [],
  travi: [],
  serramenti: [],
}

// Client finto: restituisce (o lancia) le risposte in ordine e registra i messaggi ricevuti.
function clienteFinto(...risposte: (string | Error)[]): ClienteEstrazione & { chiamate: MessaggioChat[][] } {
  const chiamate: MessaggioChat[][] = []
  return {
    chiamate,
    async completa(messaggi) {
      chiamate.push(messaggi)
      const risposta = risposte[Math.min(chiamate.length, risposte.length) - 1]
      if (risposta instanceof Error) throw risposta
      return risposta
    },
  }
}

describe('estraiCampi', () => {
  afterEach(() => vi.useRealTimers())

  it('manda prompt ed esempi e restituisce i campi normalizzati quando la risposta è corretta', async () => {
    const cliente = clienteFinto(JSON.stringify(RISPOSTA))

    const campi = await estraiCampi(TESTO, cliente)

    expect(cliente.chiamate).toEqual([messaggiEstrazione(TESTO)])
    expect(campi.cliente).toEqual({ nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' })
    expect(campi.protocollo).toBe('2026059')
    expect(campi.superfici).toEqual(RISPOSTA.superfici)
    expect(campi.spessoreCappotto).toBe('140')
    expect(campi.serramenti).toBeUndefined()
    expect(campi.campiMancanti).toEqual([])
  })

  it('applica lo strato deterministico: niente valori senza riscontro, mancanti calcolati in codice', async () => {
    const risposta = { ...RISPOSTA, protocollo: '2026060', progettista: null, campiMancanti: ['luogo'] }

    const campi = await estraiCampi(TESTO, clienteFinto(JSON.stringify(risposta)))

    expect(campi.protocollo).toBeUndefined()
    expect(campi.campiMancanti).toEqual(['protocollo', 'progettista'])
  })

  it('tollera le recinzioni markdown attorno al JSON', async () => {
    const campi = await estraiCampi(TESTO, clienteFinto('```json\n' + JSON.stringify(RISPOSTA) + '\n```'))

    expect(campi.cliente.nome).toBe('Crivellaro Mariano')
  })

  it('dopo una risposta con la forma sbagliata riprova con il messaggio unico autosufficiente', async () => {
    const cliente = clienteFinto(JSON.stringify({ ...RISPOSTA, cliente: 'Crivellaro Mariano' }), JSON.stringify(RISPOSTA))

    const campi = await estraiCampi(TESTO, cliente)

    expect(campi.cliente.nome).toBe('Crivellaro Mariano')
    expect(cliente.chiamate).toHaveLength(2)
    expect(cliente.chiamate[1]).toEqual(
      messaggioUnico(TESTO, '"cliente" deve essere un oggetto {"nome","comune","provincia"}'),
    )
  })

  it('riprova se il nome del cliente non compare nel testo (il modello ha risposto ad altro)', async () => {
    const esempioRipetuto = JSON.parse(messaggiEstrazione('')[2].content)
    const cliente = clienteFinto(JSON.stringify(esempioRipetuto), JSON.stringify(RISPOSTA))

    const campi = await estraiCampi(TESTO, cliente)

    expect(campi.cliente.nome).toBe('Crivellaro Mariano')
    expect(cliente.chiamate[1][0].content).toContain('il cliente "Zanella Giorgia" non compare nel testo')
  })

  it('dopo due tentativi falliti lancia un errore leggibile con il motivo dell\'ultimo', async () => {
    const cliente = clienteFinto('non è json')

    await expect(estraiCampi(TESTO, cliente)).rejects.toThrow('Estrazione fallita: risposta non JSON: non è json')
    expect(cliente.chiamate).toHaveLength(2)
  })

  it('dopo un errore di rete ripete la stessa richiesta, dopo una breve pausa', async () => {
    vi.useFakeTimers()
    const cliente = clienteFinto(new Error('Estrazione fallita: OpenRouter ha risposto 503 — occupato'), JSON.stringify(RISPOSTA))

    const promessa = estraiCampi(TESTO, cliente)
    await vi.advanceTimersByTimeAsync(1499)
    expect(cliente.chiamate).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(cliente.chiamate).toHaveLength(2)
    const campi = await promessa

    expect(campi.cliente.nome).toBe('Crivellaro Mariano')
    expect(cliente.chiamate).toEqual([messaggiEstrazione(TESTO), messaggiEstrazione(TESTO)])
  })

  it('dopo due errori di rete propaga il messaggio del client, senza ripetere il prefisso', async () => {
    vi.useFakeTimers()
    const cliente = clienteFinto(new Error('Estrazione fallita: OpenRouter ha risposto 402 — credito esaurito'))

    const attesa = expect(estraiCampi(TESTO, cliente)).rejects.toThrow(
      /^Estrazione fallita: OpenRouter ha risposto 402 — credito esaurito$/,
    )
    await vi.advanceTimersByTimeAsync(1499)
    expect(cliente.chiamate).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await attesa
    expect(cliente.chiamate).toHaveLength(2)
  })

  it('non riprova dopo il timeout: propaga subito il messaggio leggibile', async () => {
    const timeout = new Error('Estrazione fallita: OpenRouter non ha risposto entro 60 secondi — riprova tra qualche istante', {
      cause: new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    })
    const cliente = clienteFinto(timeout, JSON.stringify(RISPOSTA))

    await expect(estraiCampi(TESTO, cliente)).rejects.toThrow(/^Estrazione fallita: OpenRouter non ha risposto entro 60 secondi/)
    expect(cliente.chiamate).toHaveLength(1)
  })
})

describe('messaggi al modello', () => {
  // Fedeltà al sistema misurato: gli hash sono calcolati su sistema-v2 (json-libero-esempi,
  // PREFISSO_UNICO=0), valutato su ~150 estrazioni per modello. Se un hash cambia, il
  // prompt o gli esempi non sono più quelli misurati: prima di aggiornarlo va rifatta la misura.
  it('usa byte per byte prompt, esempi e messaggio unico del sistema misurato', () => {
    const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

    expect(sha256(PROMPT_SISTEMA)).toBe('91262fb66992d1ad912600858b82b05feee9564bb702b6758100f8395cbbfbf5')
    expect(sha256(JSON.stringify(messaggiEstrazione('')))).toBe(
      'f54e053f6c1712dad331055a9edd2ebaea4d612eed303674c2b05fb03cee457b',
    )
    expect(sha256(JSON.stringify(messaggioUnico('', '')))).toBe(
      'f9686334d1f1fbe9ecb6c1c16264e57f9d4319d76da1f486ee9005af9df9bf2f',
    )
  })

  it('mette gli esempi few-shot come turni di chat prima del testo dell\'operatore', () => {
    const messaggi = messaggiEstrazione('casa per Rossi')

    expect(messaggi.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user'])
    expect(messaggi[0].content).toBe(PROMPT_SISTEMA)
    expect(messaggi.at(-1)).toEqual({ role: 'user', content: 'casa per Rossi' })
  })

  it('usa esempi che hanno la forma chiesta dal prompt (tutte le chiavi presenti)', () => {
    const [, , primo, , secondo] = messaggiEstrazione('')

    for (const esempio of [primo, secondo]) {
      const oggetto = JSON.parse(esempio.content)
      expect(Object.keys(oggetto)).toEqual([...CHIAVI_ATTESE])
      expect(() => controllaForma(oggetto)).not.toThrow()
    }
  })

  it('compone il messaggio unico con istruzioni, esempi, motivo e testo in un solo turno', () => {
    const [messaggio, ...altri] = messaggioUnico('casa per Rossi', 'x'.repeat(300))

    expect(altri).toEqual([])
    expect(messaggio.role).toBe('user')
    expect(messaggio.content.startsWith(PROMPT_SISTEMA)).toBe(true)
    expect(messaggio.content).toContain('ESEMPIO 1')
    expect(messaggio.content).toContain('ESEMPIO 2')
    expect(messaggio.content).toContain(`(${'x'.repeat(200)}): usa esattamente le chiavi indicate.`)
    expect(messaggio.content.endsWith('Testo:\ncasa per Rossi\nJSON:')).toBe(true)
  })
})

describe('PROMPT_SISTEMA', () => {
  it('enumera esplicitamente i nomi piano canonici, così il modello non inventa varianti', () => {
    for (const nome of PIANI_CANONICI) {
      expect(PROMPT_SISTEMA).toContain(`"${nome}"`)
    }
  })

  it('istruisce a non scartare un piano non riconosciuto', () => {
    expect(PROMPT_SISTEMA).toContain('se non corrisponde a nessuna, riporta il nome come scritto')
  })
})

function rispostaChat(contenuto: string, extra: object = {}): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: contenuto } }], ...extra }), { status: 200 })
}

// Una Response nuova a ogni chiamata: il corpo si legge una volta sola.
function stubFetch(crea: () => Response): Mock<typeof fetch> {
  const fetchFinto = vi.fn<typeof fetch>(async () => crea())
  vi.stubGlobal('fetch', fetchFinto)
  return fetchFinto
}

function corpoInviato(fetchFinto: Mock<typeof fetch>, chiamata = 0) {
  return JSON.parse(fetchFinto.mock.calls[chiamata][1]?.body as string)
}

function intestazioniInviate(fetchFinto: Mock<typeof fetch>) {
  return fetchFinto.mock.calls[0][1]?.headers as Record<string, string>
}

describe('ClienteEstrazioneOpenRouter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const MESSAGGI: MessaggioChat[] = [{ role: 'user', content: 'casa per Rossi' }]

  function stubAmbiente(ambiente: Record<string, string | undefined> = {}) {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test')
    vi.stubEnv('OPENROUTER_MODEL', undefined)
    vi.stubEnv('OPENROUTER_REASONING', undefined)
    for (const [nome, valore] of Object.entries(ambiente)) vi.stubEnv(nome, valore)
  }

  it('chiama OpenRouter con i modelli di ripiego, json_object e i parametri misurati', async () => {
    stubAmbiente()
    const fetchFinto = stubFetch(() => rispostaChat('{"cliente":{"nome":"Rossi"}}'))

    const risultato = await new ClienteEstrazioneOpenRouter().completa(MESSAGGI)

    expect(risultato).toBe('{"cliente":{"nome":"Rossi"}}')
    const [url, opzioni] = fetchFinto.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(intestazioniInviate(fetchFinto).Authorization).toBe('Bearer sk-or-test')
    expect(opzioni?.signal).toBeInstanceOf(AbortSignal)
    expect(corpoInviato(fetchFinto)).toEqual({
      models: ['openai/gpt-6-luna', 'qwen/qwen3.8-flash'],
      messages: MESSAGGI,
      temperature: 0,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      reasoning: { enabled: false },
      provider: { ignore: ['streamlake'], data_collection: 'deny' },
    })
    expect(corpoInviato(fetchFinto)).not.toHaveProperty('model')
    expect(MODELLI_OPENROUTER_DEFAULT).toEqual(['openai/gpt-6-luna', 'qwen/qwen3.8-flash'])
  })

  it('accende il ragionamento solo con OPENROUTER_REASONING=on', async () => {
    const fetchFinto = stubFetch(() => rispostaChat('{}'))

    stubAmbiente({ OPENROUTER_REASONING: 'on' })
    await new ClienteEstrazioneOpenRouter().completa(MESSAGGI)
    stubAmbiente({ OPENROUTER_REASONING: 'off' })
    await new ClienteEstrazioneOpenRouter().completa(MESSAGGI)

    expect(corpoInviato(fetchFinto, 0).reasoning).toEqual({ enabled: true })
    expect(corpoInviato(fetchFinto, 1).reasoning).toEqual({ enabled: false })
  })

  it('legge da OPENROUTER_MODEL un elenco separato da virgole, scartando le voci vuote', async () => {
    stubAmbiente({ OPENROUTER_MODEL: ' moonshotai/kimi-k2.5 , ,deepseek/deepseek-v4-pro,' })
    const fetchFinto = stubFetch(() => rispostaChat('{}'))

    await new ClienteEstrazioneOpenRouter().completa(MESSAGGI)

    expect(corpoInviato(fetchFinto).models).toEqual(['moonshotai/kimi-k2.5', 'deepseek/deepseek-v4-pro'])
  })

  it('usa le opzioni del costruttore al posto dell\'ambiente', async () => {
    stubAmbiente({ OPENROUTER_API_KEY: undefined, OPENROUTER_MODEL: 'ignorato/modello', OPENROUTER_REASONING: 'on' })
    const fetchFinto = stubFetch(() => rispostaChat('{}'))

    await new ClienteEstrazioneOpenRouter({ chiave: 'sk-or-opzione', modelli: ['qwen/qwen3.8-flash'], ragionamento: false }).completa(MESSAGGI)

    expect(intestazioniInviate(fetchFinto).Authorization).toBe('Bearer sk-or-opzione')
    expect(corpoInviato(fetchFinto).models).toEqual(['qwen/qwen3.8-flash'])
    expect(corpoInviato(fetchFinto).reasoning).toEqual({ enabled: false })
  })

  it('con soloFornitori fissa i fornitori e vieta il ripiego (per le valutazioni)', async () => {
    stubAmbiente()
    const fetchFinto = stubFetch(() => rispostaChat('{}'))

    await new ClienteEstrazioneOpenRouter({ soloFornitori: ['openai'] }).completa(MESSAGGI)

    expect(corpoInviato(fetchFinto).provider).toEqual({
      ignore: ['streamlake'],
      data_collection: 'deny',
      only: ['openai'],
      allow_fallbacks: false,
    })
  })

  it('registra modello, fornitore e costo dell\'ultima risposta', async () => {
    stubAmbiente()
    stubFetch(() => rispostaChat('{}', { model: 'qwen/qwen3.8-flash', provider: 'Alibaba', usage: { cost: 0.0004 } }))
    const cliente = new ClienteEstrazioneOpenRouter()

    await cliente.completa(MESSAGGI)

    expect(cliente.ultimaRisposta).toEqual({ modello: 'qwen/qwen3.8-flash', fornitore: 'Alibaba', costo: 0.0004 })
  })

  it('lancia un errore se OPENROUTER_API_KEY non è impostata', () => {
    stubAmbiente({ OPENROUTER_API_KEY: undefined })
    expect(() => new ClienteEstrazioneOpenRouter()).toThrow(/OPENROUTER_API_KEY/)
  })

  it('lancia un errore leggibile se OpenRouter risponde con uno stato di errore', async () => {
    stubAmbiente()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('credito esaurito', { status: 402 })))

    await expect(new ClienteEstrazioneOpenRouter().completa(MESSAGGI)).rejects.toThrow(/Estrazione fallita: OpenRouter.*402/)
  })

  it('lancia un errore leggibile se OpenRouter segnala un errore nel corpo di una risposta 200', async () => {
    stubAmbiente()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Provider returned error' } }))))

    await expect(new ClienteEstrazioneOpenRouter().completa(MESSAGGI)).rejects.toThrow(/OpenRouter.*Provider returned error/)
  })

  it('lancia un errore leggibile se OpenRouter risponde 200 con un corpo non-JSON', async () => {
    stubAmbiente()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('non è json', { status: 200 })))

    await expect(new ClienteEstrazioneOpenRouter().completa(MESSAGGI)).rejects.toThrow(/OpenRouter.*non-JSON/)
  })

  it('lancia un errore leggibile se OpenRouter non è raggiungibile', async () => {
    stubAmbiente()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed')
      }),
    )

    await expect(new ClienteEstrazioneOpenRouter().completa(MESSAGGI)).rejects.toThrow(/OpenRouter.*connessione/)
  })

  it('lancia un errore leggibile se OpenRouter non risponde entro il timeout', async () => {
    stubAmbiente()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      }),
    )

    await expect(new ClienteEstrazioneOpenRouter().completa(MESSAGGI)).rejects.toThrow(/OpenRouter.*60 secondi/)
  })

  // AbortSignal.timeout interrompe anche la lettura del corpo: le intestazioni arrivano
  // entro il minuto, il JSON no.
  function corpoInTimeout(status: number): Response {
    const corpo = new ReadableStream({
      start(controller) {
        controller.error(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      },
    })
    return new Response(corpo, { status })
  }

  it('con estraiCampi, il timeout durante la lettura del corpo non viene ritentato', async () => {
    stubAmbiente()
    const fetchFinto = stubFetch(() => corpoInTimeout(200))

    await expect(estraiCampi(TESTO, new ClienteEstrazioneOpenRouter())).rejects.toThrow(
      /^Estrazione fallita: OpenRouter non ha risposto entro 60 secondi — riprova tra qualche istante$/,
    )
    expect(fetchFinto).toHaveBeenCalledTimes(1)
  })

  it('anche con uno stato di errore, il timeout sul corpo dà il messaggio leggibile', async () => {
    stubAmbiente()
    stubFetch(() => corpoInTimeout(503))

    const errore = await new ClienteEstrazioneOpenRouter().completa(MESSAGGI).catch((e: unknown) => e)

    expect(errore).toBeInstanceOf(Error)
    expect((errore as Error).message).toMatch(/OpenRouter non ha risposto entro 60 secondi/)
    expect(((errore as Error).cause as DOMException).name).toBe('TimeoutError')
  })

  it('con estraiCampi, il timeout del client non viene ritentato', async () => {
    stubAmbiente()
    const fetchFinto = vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    vi.stubGlobal('fetch', fetchFinto)

    await expect(estraiCampi(TESTO, new ClienteEstrazioneOpenRouter())).rejects.toThrow(
      /^Estrazione fallita: OpenRouter non ha risposto entro 60 secondi/,
    )
    expect(fetchFinto).toHaveBeenCalledTimes(1)
  })
})

describe('ClienteEstrazioneLMStudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('manda gli stessi messaggi all\'endpoint di default, a temperatura 0 e senza response_format', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'qwen2.5-7b-instruct')
    vi.stubEnv('LM_STUDIO_BASE_URL', undefined)
    const fetchFinto = stubFetch(() => rispostaChat('{"cliente":{"nome":"Rossi"}}'))
    const messaggi = messaggiEstrazione('casa per Rossi a Vicenza')

    const risultato = await new ClienteEstrazioneLMStudio().completa(messaggi)

    expect(risultato).toBe('{"cliente":{"nome":"Rossi"}}')
    expect(fetchFinto.mock.calls[0][0]).toBe('http://localhost:1234/v1/chat/completions')
    expect(corpoInviato(fetchFinto)).toEqual({ model: 'qwen2.5-7b-instruct', messages: messaggi, temperature: 0 })
  })

  it('usa LM_STUDIO_BASE_URL personalizzato quando impostato', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubEnv('LM_STUDIO_BASE_URL', 'http://192.168.1.50:1234/v1')
    const fetchFinto = stubFetch(() => rispostaChat('{}'))

    await new ClienteEstrazioneLMStudio().completa([])

    expect(fetchFinto.mock.calls[0][0]).toBe('http://192.168.1.50:1234/v1/chat/completions')
  })

  it('lancia un errore leggibile se LM Studio non è raggiungibile', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed')
      }),
    )

    await expect(new ClienteEstrazioneLMStudio().completa([])).rejects.toThrow(/LM Studio.*in esecuzione/)
  })

  it('lancia un errore leggibile se LM Studio risponde con uno stato di errore', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-inesistente')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('modello non trovato', { status: 404 })))

    await expect(new ClienteEstrazioneLMStudio().completa([])).rejects.toThrow(/404/)
  })

  it('lancia un errore leggibile se LM Studio risponde 200 con un corpo non-JSON', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('non è json', { status: 200 })))

    await expect(new ClienteEstrazioneLMStudio().completa([])).rejects.toThrow(/Estrazione fallita/)
  })

  it('lancia un errore se LM_STUDIO_MODEL non è impostata', () => {
    vi.stubEnv('LM_STUDIO_MODEL', undefined)
    expect(() => new ClienteEstrazioneLMStudio()).toThrow(/LM_STUDIO_MODEL/)
  })
})

describe('creaClienteEstrazione', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sceglie OpenRouter quando la chiave è impostata', () => {
    vi.stubEnv('AI_PROVIDER', undefined)
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test')
    expect(creaClienteEstrazione()).toBeInstanceOf(ClienteEstrazioneOpenRouter)
  })

  it('ricade su LM Studio senza chiave OpenRouter', () => {
    vi.stubEnv('AI_PROVIDER', undefined)
    vi.stubEnv('OPENROUTER_API_KEY', undefined)
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    expect(creaClienteEstrazione()).toBeInstanceOf(ClienteEstrazioneLMStudio)
  })

  it('rispetta AI_PROVIDER=lmstudio anche con la chiave OpenRouter impostata', () => {
    vi.stubEnv('AI_PROVIDER', 'lmstudio')
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test')
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    expect(creaClienteEstrazione()).toBeInstanceOf(ClienteEstrazioneLMStudio)
  })
})
