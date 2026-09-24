import { z } from 'zod'
import { CATEGORIE_SERRAMENTO, PIANI_CANONICI } from '@/domain/geometria'

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

const SchemaCampiEstratti = z.object({
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

export interface ClienteEstrazione {
  estrai(testo: string): Promise<string>
}

export async function estraiCampi(testo: string, cliente: ClienteEstrazione): Promise<CampiEstratti> {
  const rispostaGrezza = await cliente.estrai(testo)

  let parsato: unknown
  try {
    parsato = JSON.parse(rispostaGrezza)
  } catch {
    throw new Error(`Estrazione fallita: risposta non è JSON valido: ${rispostaGrezza.slice(0, 200)}`)
  }

  const risultato = SchemaCampiEstratti.safeParse(parsato)
  if (!risultato.success) {
    throw new Error(`Estrazione fallita: campi non validi — ${risultato.error.message}`)
  }

  return risultato.data
}

export const PROMPT_SISTEMA = `Estrai dal testo dell'utente i campi di un preventivo per case in legno FBE WoodLiving.
Rispondi SOLO con un oggetto JSON con questa forma, senza markdown:
{
  "cliente": { "nome": string, "comune"?: string, "provincia"?: string },
  "protocollo"?: string,
  "progettista"?: string,
  "luogo"?: string,
  "superfici": [{ "piano": string, "valoreLordo": string }],
  "tipoCopertura"?: "piano" | "falde",
  "finituraEsterna"?: "intonaco" | "rivestimento",
  "pacchetto"?: "grezzo" | "grezzo avanzato" | "chiavi in mano",
  "spessoreEsterno"?: string,
  "spessoreInterno"?: string,
  "spessoreCoibente"?: string,
  "spessoreCappotto"?: string,
  "pareti"?: [{ "n": number, "tipo": "I" | "E", "b": number, "h": number, "spessore": number }],
  "falde"?: [{ "etichetta": string, "notazione": string }],
  "travi"?: [{ "etichetta": string, "notazione": string }],
  "serramenti"?: [{ "n": number, "piano": string, "tipologia": string, "categoria": ${CATEGORIE_SERRAMENTO.map((c) => `"${c}"`).join(' | ')}, "b": number, "h": number }],
  "campiMancanti": string[]
}
Il campo "piano" di ogni superficie deve usare ESATTAMENTE una di queste stringhe,
comprese maiuscole e minuscole così come sono scritte:
${PIANI_CANONICI.map((nome) => `- "${nome}"`).join('\n')}
Esempi di normalizzazione attesa: "piano terra" → "Piano Terra"; "PT" → "Piano Terra";
"primo piano" → "Piano Primo"; "mansarda"/"sottotetto" → "Piano sottotetto";
"box auto"/"autorimessa" → "Garage".
Se un piano citato nel testo non corrisponde a nessuna di queste voci, riportalo come
lo trovi e aggiungilo a campiMancanti: sarà corretto a mano.

Gli spessori (spessoreEsterno, spessoreInterno, spessoreCoibente, spessoreCappotto) sono
testo libero in millimetri, anche composito (es. "60+40", "205-160"): riportali esattamente
come scritti dal cliente, senza normalizzarli né inventarli.

Se "luogo" non è specificato esplicitamente nel testo, NON aggiungerlo a campiMancanti:
verrà dedotto automaticamente dal comune del cliente.

Pareti, falde (copertura) e travi sono dati tecnici di riferimento, mai driver di prezzo:
se il testo li descrive, riportali così come li trovi, senza inventare né normalizzare un
formato. Per ogni parete servono numero, tipo ("I" interna o "E" esterna), base, altezza e
spessore in mm: se anche uno solo di questi manca per una parete citata, ometti quella
parete (non inventare il valore mancante). Per falde e travi riporta etichetta e notazione
esattamente come li descrive il cliente, anche in forma discorsiva: la notazione non va mai
interpretata o convertita in numero. Se il testo non menziona pareti/falde/travi, ometti i
campi corrispondenti.

Per ogni serramento (finestra, portafinestra, portoncino, vetrata fissa, infisso scorrevole)
citato nel testo servono numero progressivo, piano, tipologia (descrizione libera, es.
"finestra", "porta di ingresso"), categoria, base e altezza in metri: se anche uno solo di
questi manca per un serramento citato, ometti quel serramento (non inventare il valore
mancante). La categoria va scelta tra quelle ammesse in base alla descrizione: "porta
di ingresso"/"portoncino" → "portoncino"; "portafinestra" → "portafinestra-battente";
"finestra"/"doppia finestra" senza altre precisazioni → "finestra-battente"; "vetrata
fissa"/"fisso" → "fisso-vetrata"; "scorrevole"/"alzante scorrevole" → "alzante-scorrevole".
Se il testo non menziona serramenti, ometti il campo.

Il testo può contenere più affermazioni scritte in momenti diversi (una conversazione
a turni): se una stessa informazione compare più volte, usa l'ultima menzionata.

Se un campo non è menzionato nel testo, ometterlo o aggiungerlo a campiMancanti. Non inventare valori.`

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

  async estrai(testo: string): Promise<string> {
    let risposta: Response
    try {
      risposta = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modello,
          messages: [
            { role: 'system', content: PROMPT_SISTEMA },
            { role: 'user', content: testo },
          ],
          temperature: 0.1,
        }),
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
    return (dati as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ''
  }
}

// Modello economico con supporto a JSON Schema su OpenRouter (~0,003 $ a estrazione).
// Confrontati sul caso Crivellaro e scartati: 'moonshotai/kimi-k2.5' (lento, risposte
// non-JSON), 'deepseek/deepseek-v4-pro-0813' (campi persi a ragionamento spento).
export const MODELLO_OPENROUTER_DEFAULT = 'deepseek/deepseek-v4.1-flash'

const URL_OPENROUTER = 'https://openrouter.ai/api/v1'
const TIMEOUT_OPENROUTER_MS = 60_000

// Lo schema è in forma "input": i campi con default (superfici, campiMancanti) restano
// facoltativi per il modello; la validazione Zod in estraiCampi resta la rete di sicurezza.
const SCHEMA_JSON_CAMPI = z.toJSONSchema(SchemaCampiEstratti, { io: 'input' })

// Stesso vincolo del client LM Studio: l'AI estrae solo campi anagrafici/geometrici,
// mai prezzi o importi (vincolo CLAUDE.md #7).
export class ClienteEstrazioneOpenRouter implements ClienteEstrazione {
  private chiave: string
  private modello: string
  private ragionamento: boolean

  constructor(
    chiave: string | undefined = process.env.OPENROUTER_API_KEY,
    modello: string = process.env.OPENROUTER_MODEL || MODELLO_OPENROUTER_DEFAULT,
    ragionamento: boolean = process.env.OPENROUTER_REASONING !== 'off',
  ) {
    if (!chiave) {
      throw new Error('Estrazione fallita: variabile OPENROUTER_API_KEY non impostata — inserisci la chiave API di OpenRouter')
    }
    this.chiave = chiave
    this.modello = modello
    this.ragionamento = ragionamento
  }

  async estrai(testo: string): Promise<string> {
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
          model: this.modello,
          messages: [
            { role: 'system', content: PROMPT_SISTEMA },
            { role: 'user', content: testo },
          ],
          temperature: 0.1,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'campi_preventivo', schema: SCHEMA_JSON_CAMPI },
          },
          // Instrada solo verso fornitori che rispettano davvero response_format.
          provider: { require_parameters: true },
          // Esplicito per non dipendere dal default del modello. Misurato su Crivellaro
          // (DeepSeek V4.1 Flash): spento 21/26 controlli in ~3 s, acceso 24-26/26 in
          // ~11-19 s a ~0,003 $. Da spento perde proprio "non inventare" e "segnala mancante".
          reasoning: { enabled: this.ragionamento },
        }),
      })
    } catch (errore) {
      if (errore instanceof DOMException && errore.name === 'TimeoutError') {
        throw new Error(
          `Estrazione fallita: OpenRouter non ha risposto entro ${TIMEOUT_OPENROUTER_MS / 1000} secondi — riprova o scegli un altro modello`,
          { cause: errore },
        )
      }
      throw new Error('Estrazione fallita: impossibile raggiungere OpenRouter — verifica la connessione a internet', {
        cause: errore,
      })
    }

    if (!risposta.ok) {
      const corpo = await risposta.text()
      throw new Error(`Estrazione fallita: OpenRouter ha risposto ${risposta.status} — ${corpo.slice(0, 300)}`)
    }

    let dati: unknown
    try {
      dati = await risposta.json()
    } catch {
      throw new Error(`Estrazione fallita: OpenRouter ha risposto con un corpo non-JSON (status ${risposta.status})`)
    }
    return (dati as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? ''
  }
}

// AI_PROVIDER forza la scelta ('openrouter' | 'lmstudio'); senza, vince OpenRouter se c'è
// la chiave, altrimenti LM Studio (uso offline).
export function creaClienteEstrazione(): ClienteEstrazione {
  const fornitore = process.env.AI_PROVIDER ?? (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'lmstudio')
  return fornitore === 'openrouter' ? new ClienteEstrazioneOpenRouter() : new ClienteEstrazioneLMStudio()
}
