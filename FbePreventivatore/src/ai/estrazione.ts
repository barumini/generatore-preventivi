import { z } from 'zod'
import { CATEGORIE_SERRAMENTO, PIANI_CANONICI } from '@/domain/geometria'
import {
  controllaForma,
  normalizzaEstrazione,
  parsaJsonTollerante,
  verificaNomeCliente,
} from './normalizzazione-estrazione'

const SchemaParete = z.object({
  n: z.number(),
  tipo: z.enum(['I', 'E']),
  b: z.number(),
  h: z.number(),
  spessore: z.number(),
})

const SchemaSerramento = z.object({
  n: z.number(),
  piano: z.string(),
  tipologia: z.string(),
  categoria: z.enum(CATEGORIE_SERRAMENTO),
  b: z.number(),
  h: z.number(),
})

const SchemaVoceLibera = z.object({
  etichetta: z.string(),
  notazione: z.string(),
})

export const SchemaCampiEstratti = z.object({
  cliente: z.object({
    nome: z.string(),
    comune: z.string().optional(),
    provincia: z.string().optional(),
  }),
  protocollo: z.string().optional(),
  progettista: z.string().optional(),
  luogo: z.string().optional(),
  superfici: z.array(z.object({ piano: z.string(), valoreLordo: z.string() })).default([]),
  tipoCopertura: z.enum(['piano', 'falde']).optional(),
  finituraEsterna: z.enum(['intonaco', 'rivestimento']).optional(),
  pacchetto: z.enum(['grezzo', 'grezzo avanzato', 'chiavi in mano']).optional(),
  spessoreEsterno: z.string().optional(),
  spessoreInterno: z.string().optional(),
  spessoreCoibente: z.string().optional(),
  spessoreCappotto: z.string().optional(),
  pareti: z.array(SchemaParete).optional(),
  falde: z.array(SchemaVoceLibera).optional(),
  travi: z.array(SchemaVoceLibera).optional(),
  serramenti: z.array(SchemaSerramento).optional(),
  campiMancanti: z.array(z.string()).default([]),
})

export type CampiEstratti = z.infer<typeof SchemaCampiEstratti>

export type MessaggioChat = { role: 'system' | 'user' | 'assistant'; content: string }

// Il client fa solo il trasporto: riceve i messaggi già composti e restituisce il testo
// grezzo della risposta. Prompt, nuovi tentativi e normalizzazione stanno in estraiCampi,
// così OpenRouter e LM Studio si comportano allo stesso modo.
export interface ClienteEstrazione {
  completa(messaggi: MessaggioChat[]): Promise<string>
}

// ---------------------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------------------

// Sistema "json-libero-esempi v2", misurato su ~150 estrazioni per modello senza errori
// (gpt-6-luna e qwen3.8-flash a ragionamento spento). Il testo del prompt e degli esempi è
// quello misurato, byte per byte: cambiarlo vuol dire rifare la misura.
//   1. niente schema: response_format {"type":"json_object"} e un modello di risposta in cui
//      TUTTE le chiavi sono sempre presenti (null / [] se il dato non c'è), così il modello
//      non deve decidere se aprire una chiave ma solo cosa scriverci;
//   2. due esempi completi input→output su dati inventati (few-shot come turni di chat);
//   3. le regole di dominio applicate in codice (normalizzazione-estrazione.ts).
export const PROMPT_SISTEMA = `Estrai i dati di un preventivo per case in legno (FBE WoodLiving) dal testo dell'operatore.
Rispondi SOLO con un oggetto JSON compatto, senza markdown né commenti, con TUTTE queste chiavi sempre presenti:
{"cliente":{"nome":…,"comune":…,"provincia":…},"protocollo":…,"progettista":…,"luogo":…,"superfici":[…],"tipoCopertura":…,"finituraEsterna":…,"pacchetto":…,"spessoreEsterno":…,"spessoreInterno":…,"spessoreCoibente":…,"spessoreCappotto":…,"pareti":[…],"falde":[…],"travi":[…],"serramenti":[…]}

REGOLE
1. Non inventare nulla. Un dato che il testo non scrive vale null (per le liste: []). Non dedurre, non stimare, non copiare un valore da un altro elemento.
2. Il testo può essere una conversazione a turni: se un dato compare più volte, vale l'ultima versione.
3. cliente.nome: nome e cognome come scritti. cliente.comune: comune del cliente. cliente.provincia: come scritta (es. "PD"). protocollo: il numero di protocollo come scritto. progettista: come scritto, titolo compreso. luogo: luogo del cantiere SOLO se scritto esplicitamente, altrimenti null.
4. superfici: una voce {"piano","valoreLordo"} per ogni piano con la sua superficie. "piano" deve essere una di: ${PIANI_CANONICI.map((p) => `"${p}"`).join(', ')} (piano terra/PT → "Piano Terra"; primo piano → "Piano Primo"; mansarda/sottotetto → "Piano sottotetto"; box auto/autorimessa → "Garage"); se non corrisponde a nessuna, riporta il nome come scritto. "valoreLordo" è una stringa con il solo numero COME SCRITTO, senza unità: "20+18" resta "20+18" (mai sommare), "75,5" resta "75,5".
5. tipoCopertura: "falde" oppure "piano". finituraEsterna: "intonaco" oppure "rivestimento". pacchetto: "grezzo", "grezzo avanzato" oppure "chiavi in mano". null se non detto.
6. Spessori generali della casa: spessoreEsterno (parete esterna), spessoreInterno (parete interna), spessoreCoibente (isolante/coibente), spessoreCappotto (cappotto). Stringa con il solo numero in mm come scritto, senza "mm": "180", "60+40". Gli spessori NON vanno mai in pareti, falde o travi.
7. pareti: solo pareti descritte una per una con le loro misure: {"n","tipo":"E" esterna o "I" interna,"b" base in m,"h" altezza in m,"spessore" in mm}. Se una misura non è scritta, mettila null.
8. falde: solo falde del tetto descritte con misure o notazione, {"etichetta","notazione"} copiate dal testo. La frase "copertura a falde" da sola NON è una falda: va solo in tipoCopertura. travi: solo travi citate esplicitamente, stessa forma. Se il testo non ne parla: [].
9. serramenti (finestre, portefinestre, porte di ingresso/portoncini, vetrate fisse, scorrevoli): {"n" progressivo,"piano","tipologia" come scritta,"categoria","b" base in m,"h" altezza in m}. categoria: porta di ingresso/portoncino → "portoncino"; portafinestra → "portafinestra-battente"; finestra → "finestra-battente"; vetrata fissa/fisso → "fisso-vetrata"; scorrevole/alzante scorrevole → "alzante-scorrevole". Se base, altezza o piano di un serramento non sono scritti, metti null in quel campo: NON inventarli e NON copiarli da un altro serramento.
10. Nei numeri JSON usa il punto decimale (2,4 m → 2.4).`

// Esempi su dati inventati: coprono unità da togliere, forma composita ("12 + 9", "60+40"),
// piani da canonicizzare, una correzione a fine conversazione, un serramento senza altezza
// (null, poi scartato in codice), falda e trave descritte, luogo esplicito.
const ESEMPIO_1_TESTO = `Cliente: Zanella Giorgia, comune di Cittadella, provincia PD. Protocollo n. 2027114, progettista geom. Luca Ferro.
Superfici: piano terra 96 mq, primo piano 88,5 mq, terrazzo 12 + 9 mq, box auto 30 mq.
Tetto piano, rivestimento esterno, formula chiavi in mano.
Spessori: pareti esterne 180 mm, interne 120 mm, isolante 60+40 mm, cappotto 100 mm.
Al piano terra un portoncino 1,1 x 2,3 m e una finestra 1,2 x 1,4 m; al primo piano una portafinestra larga 0,9 m.`

const ESEMPIO_1_JSON = {
  cliente: { nome: 'Zanella Giorgia', comune: 'Cittadella', provincia: 'PD' },
  protocollo: '2027114',
  progettista: 'geom. Luca Ferro',
  luogo: null,
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '96' },
    { piano: 'Piano Primo', valoreLordo: '88,5' },
    { piano: 'Terrazzo', valoreLordo: '12 + 9' },
    { piano: 'Garage', valoreLordo: '30' },
  ],
  tipoCopertura: 'piano',
  finituraEsterna: 'rivestimento',
  pacchetto: 'chiavi in mano',
  spessoreEsterno: '180',
  spessoreInterno: '120',
  spessoreCoibente: '60+40',
  spessoreCappotto: '100',
  pareti: [],
  falde: [],
  travi: [],
  serramenti: [
    { n: 1, piano: 'Piano Terra', tipologia: 'portoncino', categoria: 'portoncino', b: 1.1, h: 2.3 },
    { n: 2, piano: 'Piano Terra', tipologia: 'finestra', categoria: 'finestra-battente', b: 1.2, h: 1.4 },
    { n: 3, piano: 'Piano Primo', tipologia: 'portafinestra', categoria: 'portafinestra-battente', b: 0.9, h: null },
  ],
}

const ESEMPIO_2_TESTO = `Preventivo per Bortolami Enrico, comune di Montebelluna, provincia TV. Copertura a falde, finitura a intonaco, pacchetto grezzo.
Superfici: pianterreno 110 mq, mansarda 64 mq, portico 18 mq.
C'è una parete esterna di base 9,4 m, altezza 2,8 m, spessore 200 mm, e una parete interna di base 4 m e altezza 2,6 m.
La copertura ha una falda con notazione 6,1x12 x13,5 e una trave di colmo in lamellare da 12 m.
Cantiere a Caerano di San Marco.
correggo: il portico è 22 mq e il cliente abita a Volpago del Montello`

const ESEMPIO_2_JSON = {
  cliente: { nome: 'Bortolami Enrico', comune: 'Volpago del Montello', provincia: 'TV' },
  protocollo: null,
  progettista: null,
  luogo: 'Caerano di San Marco',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '110' },
    { piano: 'Piano sottotetto', valoreLordo: '64' },
    { piano: 'Portico', valoreLordo: '22' },
  ],
  tipoCopertura: 'falde',
  finituraEsterna: 'intonaco',
  pacchetto: 'grezzo',
  spessoreEsterno: null,
  spessoreInterno: null,
  spessoreCoibente: null,
  spessoreCappotto: null,
  pareti: [
    { n: 1, tipo: 'E', b: 9.4, h: 2.8, spessore: 200 },
    { n: 2, tipo: 'I', b: 4, h: 2.6, spessore: null },
  ],
  falde: [{ etichetta: 'falda', notazione: '6,1x12 x13,5' }],
  travi: [{ etichetta: 'trave di colmo', notazione: 'in lamellare da 12 m' }],
  serramenti: [],
}

// Primo tentativo: prompt di sistema ed esempi come turni di chat, poi il testo dell'operatore.
export function messaggiEstrazione(testo: string): MessaggioChat[] {
  return [
    { role: 'system', content: PROMPT_SISTEMA },
    { role: 'user', content: ESEMPIO_1_TESTO },
    { role: 'assistant', content: JSON.stringify(ESEMPIO_1_JSON) },
    { role: 'user', content: ESEMPIO_2_TESTO },
    { role: 'assistant', content: JSON.stringify(ESEMPIO_2_JSON) },
    { role: 'user', content: testo },
  ]
}

// Richiesta autosufficiente per il nuovo tentativo: istruzioni, esempi e testo in un solo
// messaggio, così regge anche un fornitore che perde il messaggio di sistema o i turni.
export function messaggioUnico(testo: string, motivo: string): MessaggioChat[] {
  const contenuto = `${PROMPT_SISTEMA}

ESEMPIO 1
Testo:
${ESEMPIO_1_TESTO}
JSON:
${JSON.stringify(ESEMPIO_1_JSON)}

ESEMPIO 2
Testo:
${ESEMPIO_2_TESTO}
JSON:
${JSON.stringify(ESEMPIO_2_JSON)}

Un tentativo precedente su questo testo non era valido (${motivo.slice(0, 200)}): usa esattamente le chiavi indicate.
Testo:
${testo}
JSON:`
  return [{ role: 'user', content: contenuto }]
}

// ---------------------------------------------------------------------------------------
// Estrazione
// ---------------------------------------------------------------------------------------

const TENTATIVI = 2
const PAUSA_DOPO_ERRORE_RETE_MS = 1500
const PREFISSO_ERRORE = 'Estrazione fallita: '

// I client hanno già messaggi leggibili con il prefisso: qui si toglie per non ripeterlo
// quando estraiCampi compone il proprio.
function descrizione(errore: unknown): string {
  const messaggio = errore instanceof Error ? errore.message : String(errore)
  return messaggio.startsWith(PREFISSO_ERRORE) ? messaggio.slice(PREFISSO_ERRORE.length) : messaggio
}

// Il timeout (60 s) arriva come TimeoutError di AbortSignal, direttamente o come causa.
function erroreDiTimeout(errore: unknown): boolean {
  const nome = (e: unknown) => (typeof e === 'object' && e !== null ? (e as { name?: unknown }).name : undefined)
  return nome(errore) === 'TimeoutError' || (errore instanceof Error && nome(errore.cause) === 'TimeoutError')
}

// Rete di sicurezza: normalizzaEstrazione produce già campi validi per lo schema di produzione.
function valida(campi: CampiEstratti): CampiEstratti {
  const risultato = SchemaCampiEstratti.safeParse(campi)
  if (!risultato.success) throw new Error(`campi non validi — ${risultato.error.message}`)
  return risultato.data
}

// Due tentativi. Un errore di rete o del fornitore (429, 5xx) ripete la stessa richiesta
// dopo una breve pausa (OpenRouter di norma la instrada su un altro fornitore); il timeout
// no: dopo un minuto di attesa l'operatore ha bisogno di un messaggio, non di un altro
// minuto. Una risposta con la forma sbagliata passa al messaggio unico autosufficiente.
export async function estraiCampi(testo: string, cliente: ClienteEstrazione): Promise<CampiEstratti> {
  let messaggi = messaggiEstrazione(testo)
  let ultimoErrore: unknown
  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
    let grezzo: string
    try {
      grezzo = await cliente.completa(messaggi)
    } catch (e) {
      if (erroreDiTimeout(e)) throw new Error(`${PREFISSO_ERRORE}${descrizione(e)}`, { cause: e })
      ultimoErrore = e
      if (tentativo < TENTATIVI) await new Promise((r) => setTimeout(r, PAUSA_DOPO_ERRORE_RETE_MS))
      continue
    }
    try {
      const oggetto = controllaForma(parsaJsonTollerante(grezzo))
      verificaNomeCliente(oggetto, testo)
      return valida(normalizzaEstrazione(oggetto, testo))
    } catch (e) {
      ultimoErrore = e
      messaggi = messaggioUnico(testo, descrizione(e))
    }
  }
  throw new Error(`${PREFISSO_ERRORE}${descrizione(ultimoErrore)}`, { cause: ultimoErrore })
}

// ---------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------

function leggiModelloRichiesto(): string {
  const modello = process.env.LM_STUDIO_MODEL
  if (!modello) {
    throw new Error(
      'Estrazione fallita: variabile LM_STUDIO_MODEL non impostata — imposta il nome esatto del modello caricato in LM Studio',
    )
  }
  return modello
}

// NOTA: l'estrazione LLM qui riguarda SOLO campi anagrafici/geometrici dal testo libero
// iniziale (nome cliente, comune, superfici dichiarate, tipo copertura, ecc.).
// L'AI non decide MAI prezzi o importi (vincolo CLAUDE.md #7): quelli vengono dal
// listino parametrico o sono digitati altrove nel flusso.
export class ClienteEstrazioneLMStudio implements ClienteEstrazione {
  private baseUrl: string
  private modello: string

  constructor(
    baseUrl: string = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
    modello: string = leggiModelloRichiesto(),
  ) {
    this.baseUrl = baseUrl
    this.modello = modello
  }

  // Niente response_format: LM Studio non accetta {"type":"json_object"}. Il prompt chiede
  // comunque solo JSON e parsaJsonTollerante regge recinzioni e testo attorno.
  async completa(messaggi: MessaggioChat[]): Promise<string> {
    let risposta: Response
    try {
      risposta = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.modello, messages: messaggi, temperature: 0 }),
      })
    } catch (errore) {
      throw new Error(
        `Estrazione fallita: impossibile raggiungere LM Studio su ${this.baseUrl} — verifica che LM Studio sia in esecuzione con il server locale attivo (Impostazioni > Local Server > Start Server)`,
        { cause: errore },
      )
    }

    if (!risposta.ok) {
      const corpo = await risposta.text()
      throw new Error(`Estrazione fallita: LM Studio ha risposto ${risposta.status} — ${corpo.slice(0, 300)}`)
    }

    let dati: unknown
    try {
      dati = await risposta.json()
    } catch {
      throw new Error(`Estrazione fallita: LM Studio ha risposto con un corpo non-JSON (status ${risposta.status})`)
    }
    return (dati as { choices?: { message?: { content?: string | null } }[] }).choices?.[0]?.message?.content ?? ''
  }
}

// Misurati col sistema v2 a ragionamento spento, senza errori su ~150 estrazioni ciascuno.
// OpenRouter prova il primo e passa al secondo solo se il primo non risponde.
export const MODELLI_OPENROUTER_DEFAULT = ['openai/gpt-6-luna', 'qwen/qwen3.8-flash'] as const

export interface OpzioniOpenRouter {
  chiave?: string
  modelli?: string[]
  ragionamento?: boolean
  // Solo per le valutazioni: fissa i fornitori (provider.only) e vieta il ripiego su altri.
  soloFornitori?: string[]
}

const URL_OPENROUTER = 'https://openrouter.ai/api/v1'
const TIMEOUT_OPENROUTER_MS = 60_000

// Misurato: StreamLake, con la cache dei prefissi, a tratti restituiva la continuazione di
// una conversazione ALTRUI ({"suggestions":[...]}) proprio sul prefisso del nostro prompt.
const FORNITORI_ESCLUSI = ['streamlake']

// AbortSignal.timeout interrompe anche la lettura del corpo, non solo l'attesa delle
// intestazioni: il fornitore può mandare subito lo stato 200 e poi metterci più di un minuto
// a generare il JSON. In ogni caso l'operatore legge lo stesso messaggio, con il TimeoutError
// come causa, così estraiCampi lo riconosce e non ripete la richiesta.
function erroreTimeoutOpenRouter(errore: unknown): Error | undefined {
  if (!(errore instanceof DOMException && errore.name === 'TimeoutError')) return undefined
  return new Error(
    `Estrazione fallita: OpenRouter non ha risposto entro ${TIMEOUT_OPENROUTER_MS / 1000} secondi — riprova tra qualche istante`,
    { cause: errore },
  )
}

// OPENROUTER_MODEL accetta un elenco separato da virgole (in ordine di preferenza).
function modelliDa(elenco: readonly string[] | undefined): string[] {
  const modelli = (elenco ?? []).map((m) => m.trim()).filter((m) => m !== '')
  return modelli.length > 0 ? modelli : [...MODELLI_OPENROUTER_DEFAULT]
}

interface RispostaOpenRouter {
  model?: string
  provider?: string
  usage?: { cost?: number }
  choices?: { message?: { content?: string | null } }[]
  error?: { message?: string }
}

// Stesso vincolo del client LM Studio: l'AI estrae solo campi anagrafici/geometrici,
// mai prezzi o importi (vincolo CLAUDE.md #7).
export class ClienteEstrazioneOpenRouter implements ClienteEstrazione {
  private chiave: string
  private modelli: string[]
  private ragionamento: boolean
  private soloFornitori?: string[]
  // Modello e fornitore che hanno risposto davvero, e il costo: servono alle valutazioni.
  ultimaRisposta?: { modello?: string; fornitore?: string; costo?: number }

  constructor(opzioni: OpzioniOpenRouter = {}) {
    const chiave = opzioni.chiave ?? process.env.OPENROUTER_API_KEY
    if (!chiave) {
      throw new Error('Estrazione fallita: variabile OPENROUTER_API_KEY non impostata — inserisci la chiave API di OpenRouter')
    }
    this.chiave = chiave
    this.modelli = modelliDa(opzioni.modelli ?? process.env.OPENROUTER_MODEL?.split(','))
    // Spento di default: il v2 è stato misurato così (più veloce e senza errori).
    this.ragionamento = opzioni.ragionamento ?? process.env.OPENROUTER_REASONING === 'on'
    this.soloFornitori = opzioni.soloFornitori?.length ? opzioni.soloFornitori : undefined
  }

  async completa(messaggi: MessaggioChat[]): Promise<string> {
    this.ultimaRisposta = undefined
    let risposta: Response
    try {
      risposta = await fetch(`${URL_OPENROUTER}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_OPENROUTER_MS),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.chiave}`,
          'X-Title': 'FBE Preventivatore',
        },
        body: JSON.stringify({
          models: this.modelli,
          messages: messaggi,
          temperature: 0,
          max_tokens: 2500,
          response_format: { type: 'json_object' },
          reasoning: { enabled: this.ragionamento },
          provider: {
            ignore: FORNITORI_ESCLUSI,
            // I testi contengono nomi e indirizzi dei clienti: solo fornitori che non li conservano.
            data_collection: 'deny',
            ...(this.soloFornitori ? { only: this.soloFornitori, allow_fallbacks: false } : {}),
          },
        }),
      })
    } catch (errore) {
      throw (
        erroreTimeoutOpenRouter(errore) ??
        new Error('Estrazione fallita: impossibile raggiungere OpenRouter — verifica la connessione a internet', {
          cause: errore,
        })
      )
    }

    if (!risposta.ok) {
      let corpo: string
      try {
        corpo = await risposta.text()
      } catch (errore) {
        throw erroreTimeoutOpenRouter(errore) ?? errore
      }
      throw new Error(`Estrazione fallita: OpenRouter ha risposto ${risposta.status} — ${corpo.slice(0, 300)}`)
    }

    let dati: RispostaOpenRouter
    try {
      dati = (await risposta.json()) as RispostaOpenRouter
    } catch (errore) {
      throw (
        erroreTimeoutOpenRouter(errore) ??
        new Error(`Estrazione fallita: OpenRouter ha risposto con un corpo non-JSON (status ${risposta.status})`)
      )
    }
    this.ultimaRisposta = { modello: dati.model, fornitore: dati.provider, costo: dati.usage?.cost }
    // Con lo stato 200 OpenRouter può comunque riportare l'errore del fornitore nel corpo.
    if (dati.error) throw new Error(`Estrazione fallita: OpenRouter ha segnalato un errore — ${dati.error.message ?? 'senza dettagli'}`)
    return dati.choices?.[0]?.message?.content ?? ''
  }
}

// AI_PROVIDER forza la scelta ('openrouter' | 'lmstudio'); senza, vince OpenRouter se c'è
// la chiave, altrimenti LM Studio (uso offline).
export function creaClienteEstrazione(): ClienteEstrazione {
  const fornitore = process.env.AI_PROVIDER ?? (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'lmstudio')
  return fornitore === 'openrouter' ? new ClienteEstrazioneOpenRouter() : new ClienteEstrazioneLMStudio()
}
