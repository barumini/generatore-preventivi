// Valuta l'estrazione AI contro OpenRouter sugli insiemi di src/ai/valutazione/insiemi.ts
// (sviluppo, controllo, avversari: vedi docs/valutazione-modelli-estrazione.md). Consuma
// credito OpenRouter: controlla il residuo prima di lanciare molte ripetizioni.
//
//   node --env-file=.env.local --import tsx scripts/valuta-estrazione.ts \
//     [--set sviluppo|controllo|avversari|tutti] [--modello a,b] [--ragionamento on|off] \
//     [--ripetizioni 2] [--fornitore slug] [--dettagli file.json]
//
// Default: --set tutti, --ripetizioni 2. Senza --modello / --ragionamento usa la stessa
// configurazione dell'app (OPENROUTER_MODEL come elenco separato da virgole, poi i modelli di
// default; ragionamento acceso solo con OPENROUTER_REASONING=on). --fornitore fissa i
// fornitori (provider.only, senza ripiego; più slug separati da virgole). Esce con codice 1
// se anche un solo controllo fallisce.
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
  ClienteEstrazioneOpenRouter,
  estraiCampi,
  MODELLI_OPENROUTER_DEFAULT,
  type CampiEstratti,
  type ClienteEstrazione,
  type MessaggioChat,
} from '../src/ai/estrazione'
import { INSIEMI_VALUTAZIONE, type NomeInsieme } from '../src/ai/valutazione/insiemi'
import { valutaCaso, type CasoValutazione, type EsitoControllo } from '../src/ai/valutazione-estrazione'

const { values: argomenti } = parseArgs({
  options: {
    set: { type: 'string', default: 'tutti' },
    modello: { type: 'string' },
    ragionamento: { type: 'string' },
    ripetizioni: { type: 'string', default: '2' },
    fornitore: { type: 'string' },
    dettagli: { type: 'string' },
  },
})

function esci(messaggio: string): never {
  console.error(messaggio)
  process.exit(2)
}

const NOMI_INSIEMI = Object.keys(INSIEMI_VALUTAZIONE) as NomeInsieme[]
const insiemi: NomeInsieme[] =
  argomenti.set === 'tutti'
    ? NOMI_INSIEMI
    : NOMI_INSIEMI.includes(argomenti.set as NomeInsieme)
      ? [argomenti.set as NomeInsieme]
      : esci(`--set ${argomenti.set} non valido: usa ${[...NOMI_INSIEMI, 'tutti'].join(' | ')}`)

const ripetizioni = Number(argomenti.ripetizioni)
if (!Number.isInteger(ripetizioni) || ripetizioni < 1) esci(`--ripetizioni ${argomenti.ripetizioni} non valido: serve un intero ≥ 1`)

if (argomenti.ragionamento !== undefined && !['on', 'off'].includes(argomenti.ragionamento)) {
  esci(`--ragionamento ${argomenti.ragionamento} non valido: usa on | off`)
}

// Stessa lettura del client (elenco separato da virgole, vuoti scartati): la configurazione
// si passa esplicita a ogni client, così quella stampata è quella usata.
function elenco(valore: string | undefined): string[] {
  return (valore ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '')
}
const modelliDaArgomenti = elenco(argomenti.modello ?? process.env.OPENROUTER_MODEL)
const modelli = modelliDaArgomenti.length > 0 ? modelliDaArgomenti : [...MODELLI_OPENROUTER_DEFAULT]
const ragionamento = (argomenti.ragionamento ?? process.env.OPENROUTER_REASONING) === 'on'
const soloFornitori = elenco(argomenti.fornitore)

function nuovoCliente(): ClienteEstrazioneOpenRouter {
  return new ClienteEstrazioneOpenRouter({ modelli, ragionamento, soloFornitori })
}
// Fallisce subito, con l'errore leggibile del client, se manca OPENROUTER_API_KEY.
try {
  nuovoCliente()
} catch (e) {
  esci(e instanceof Error ? e.message : String(e))
}

type DatiRisposta = NonNullable<ClienteEstrazioneOpenRouter['ultimaRisposta']>

// Un client per esecuzione: le estrazioni girano in parallelo e ultimaRisposta si riferisce
// alla sola ultima chiamata. Questo involucro le registra tutte, perché estraiCampi può farne
// due (nuovo tentativo) e il costo del primo tentativo va contato.
class ClienteRegistrato implements ClienteEstrazione {
  readonly chiamate: DatiRisposta[] = []
  private cliente = nuovoCliente()

  async completa(messaggi: MessaggioChat[]): Promise<string> {
    try {
      return await this.cliente.completa(messaggi)
    } finally {
      // Assente se la chiamata è fallita prima di leggere il corpo (rete, timeout, stato ≠ 200).
      this.chiamate.push(this.cliente.ultimaRisposta ?? {})
    }
  }
}

interface Esecuzione {
  insieme: NomeInsieme
  caso: string
  ripetizione: number
  millisecondi: number
  chiamate: DatiRisposta[]
  campi: CampiEstratti | null
  errore?: string
  esiti: EsitoControllo[]
}

async function esegui(insieme: NomeInsieme, caso: CasoValutazione, ripetizione: number): Promise<Esecuzione> {
  const cliente = new ClienteRegistrato()
  const inizio = performance.now()
  let campi: CampiEstratti | null = null
  let errore: string | undefined
  try {
    campi = await estraiCampi(caso.testo, cliente)
  } catch (e) {
    errore = e instanceof Error ? e.message : String(e)
  }
  return {
    insieme,
    caso: caso.id,
    ripetizione,
    millisecondi: Math.round(performance.now() - inizio),
    chiamate: cliente.chiamate,
    campi,
    errore,
    esiti: valutaCaso(caso, campi),
  }
}

// Tutte in parallelo, come nelle misure che hanno scelto i modelli di default.
const esecuzioni = await Promise.all(
  insiemi.flatMap((insieme) =>
    INSIEMI_VALUTAZIONE[insieme].flatMap((caso) =>
      Array.from({ length: ripetizioni }, (_, r) => esegui(insieme, caso, r + 1)),
    ),
  ),
)

function punteggio(esiti: EsitoControllo[]): string {
  return `${esiti.filter((e) => e.superato).length}/${esiti.length}`
}

function conteggio(valori: (string | undefined)[]): string {
  const conti = new Map<string, number>()
  for (const v of valori) conti.set(v ?? '(non riportato)', (conti.get(v ?? '(non riportato)') ?? 0) + 1)
  return [...conti].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ×${n}`).join(' · ')
}

const secondi = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const dollari = (d: number) => `${d.toFixed(5)} $`

const tutti = esecuzioni.flatMap((e) => e.esiti)
const tempi = esecuzioni.map((e) => e.millisecondi).sort((a, b) => a - b)
const chiamate = esecuzioni.flatMap((e) => e.chiamate)
const costo = chiamate.reduce((s, c) => s + (c.costo ?? 0), 0)
const senzaCosto = chiamate.filter((c) => c.costo === undefined).length

console.log(
  `modelli ${modelli.join(',')} · ragionamento ${ragionamento ? 'on' : 'off'}` +
    `${soloFornitori.length ? ` · solo fornitori ${soloFornitori.join(',')}` : ''} · ${ripetizioni} ${ripetizioni === 1 ? 'ripetizione' : 'ripetizioni'}`,
)
for (const insieme of insiemi) {
  const esiti = esecuzioni.filter((e) => e.insieme === insieme).flatMap((e) => e.esiti)
  console.log(`  ${insieme.padEnd(10)} ${punteggio(esiti)}`)
}
console.log(`  ${'totale'.padEnd(10)} ${punteggio(tutti)}`)
console.log(`tempo: mediana ${secondi(tempi[Math.floor(tempi.length / 2)])} · massimo ${secondi(tempi.at(-1)!)}`)
console.log(
  `costo: ${dollari(costo)} totale · ${dollari(costo / esecuzioni.length)} per estrazione · ` +
    `${chiamate.length} chiamate per ${esecuzioni.length} estrazioni` +
    `${senzaCosto ? ` (${senzaCosto} senza costo riportato)` : ''}`,
)
console.log(`modelli effettivi: ${conteggio(chiamate.map((c) => c.modello))}`)
console.log(`fornitori effettivi: ${conteggio(chiamate.map((c) => c.fornitore))}`)

for (const e of esecuzioni) {
  const falliti = e.esiti.filter((x) => !x.superato)
  if (e.errore) console.log(`  ✗ ${e.insieme}/${e.caso} #${e.ripetizione}: ERRORE ${e.errore.slice(0, 200)}`)
  else if (falliti.length) console.log(`  ✗ ${e.insieme}/${e.caso} #${e.ripetizione}: ${falliti.map((x) => x.controllo).join(' · ')}`)
}

if (argomenti.dettagli) writeFileSync(argomenti.dettagli, JSON.stringify(esecuzioni, null, 2))
process.exitCode = tutti.every((e) => e.superato) ? 0 : 1
