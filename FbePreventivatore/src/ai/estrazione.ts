import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { PIANI_CANONICI } from '@/domain/geometria'

const SchemaCampiEstratti = z.object({
  cliente: z.object({
    nome: z.string(),
    comune: z.string().optional(),
    provincia: z.string().optional(),
  }),
  protocollo: z.string().optional(),
  superfici: z.array(z.object({ piano: z.string(), valoreLordo: z.string() })).default([]),
  tipoCopertura: z.enum(['piano', 'falde']).optional(),
  finituraEsterna: z.enum(['intonaco', 'rivestimento']).optional(),
  pacchetto: z.enum(['grezzo', 'grezzo avanzato', 'chiavi in mano']).optional(),
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
  "superfici": [{ "piano": string, "valoreLordo": string }],
  "tipoCopertura"?: "piano" | "falde",
  "finituraEsterna"?: "intonaco" | "rivestimento",
  "pacchetto"?: "grezzo" | "grezzo avanzato" | "chiavi in mano",
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

Se un campo non è menzionato nel testo, ometterlo o aggiungerlo a campiMancanti. Non inventare valori.`

// NOTA: l'estrazione LLM qui riguarda SOLO campi anagrafici/geometrici dal testo libero
// iniziale (nome cliente, comune, superfici dichiarate, tipo copertura, ecc.).
// L'AI non decide MAI prezzi o importi (vincolo CLAUDE.md #7): quelli vengono dal
// listino parametrico o sono digitati altrove nel flusso.
export class ClienteEstrazioneAnthropic implements ClienteEstrazione {
  private client: Anthropic

  constructor(apiKey: string = process.env.ANTHROPIC_API_KEY ?? '') {
    this.client = new Anthropic({ apiKey })
  }

  async estrai(testo: string): Promise<string> {
    const messaggio = await this.client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: PROMPT_SISTEMA,
      messages: [{ role: 'user', content: testo }],
    })
    const blocco = messaggio.content[0]
    return blocco?.type === 'text' ? blocco.text : ''
  }
}
