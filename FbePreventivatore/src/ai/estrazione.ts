import { z } from 'zod'
import { PIANI_CANONICI } from '@/domain/geometria'

const SchemaParete = z.object({
  n: z.number(),
  tipo: z.enum(['I', 'E']),
  b: z.number(),
  h: z.number(),
  spessore: z.number(),
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
