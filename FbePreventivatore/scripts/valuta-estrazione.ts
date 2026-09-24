// Valuta l'estrazione AI contro un modello OpenRouter vero sui casi di
// src/ai/valutazione-estrazione.ts. Consuma credito OpenRouter (~0,003 $ a chiamata).
//
//   node --env-file=.env.local --import tsx scripts/valuta-estrazione.ts \
//     [--modello deepseek/deepseek-v4-pro] [--ragionamento on|off] [--ripetizioni 2] [--dettagli file.json]
//
// Senza --modello / --ragionamento usa la stessa configurazione dell'app (OPENROUTER_MODEL,
// OPENROUTER_REASONING). Esce con codice 1 se anche un solo controllo fallisce.
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { ClienteEstrazioneOpenRouter, estraiCampi, MODELLO_OPENROUTER_DEFAULT, type CampiEstratti } from '../src/ai/estrazione'
import { CASI_VALUTAZIONE, valutaCaso, type EsitoControllo } from '../src/ai/valutazione-estrazione'

const { values: argomenti } = parseArgs({
  options: {
    modello: { type: 'string' },
    ragionamento: { type: 'string' },
    ripetizioni: { type: 'string', default: '2' },
    dettagli: { type: 'string' },
  },
})

const ripetizioni = Number(argomenti.ripetizioni)
const modello = argomenti.modello ?? (process.env.OPENROUTER_MODEL || MODELLO_OPENROUTER_DEFAULT)
const ragionamento = (argomenti.ragionamento ?? process.env.OPENROUTER_REASONING) !== 'off'
const cliente = new ClienteEstrazioneOpenRouter(process.env.OPENROUTER_API_KEY, modello, ragionamento)

interface Esecuzione {
  caso: string
  ripetizione: number
  millisecondi: number
  campi: CampiEstratti | null
  errore?: string
  esiti: EsitoControllo[]
}

async function esegui(casoIndice: number, ripetizione: number): Promise<Esecuzione> {
  const caso = CASI_VALUTAZIONE[casoIndice]
  const inizio = performance.now()
  let campi: CampiEstratti | null = null
  let errore: string | undefined
  try {
    campi = await estraiCampi(caso.testo, cliente)
  } catch (e) {
    errore = e instanceof Error ? e.message : String(e)
  }
  return {
    caso: caso.id,
    ripetizione,
    millisecondi: Math.round(performance.now() - inizio),
    campi,
    errore,
    esiti: valutaCaso(caso, campi),
  }
}

const esecuzioni = await Promise.all(
  CASI_VALUTAZIONE.flatMap((_, i) => Array.from({ length: ripetizioni }, (_, r) => esegui(i, r + 1))),
)

const tutti = esecuzioni.flatMap((e) => e.esiti)
const superati = tutti.filter((e) => e.superato).length
const tempi = esecuzioni.map((e) => e.millisecondi).sort((a, b) => a - b)

console.log(`modello ${modello} · ragionamento ${ragionamento ? 'on' : 'off'} · ${ripetizioni} ripetizioni`)
console.log(`controlli superati: ${superati}/${tutti.length}`)
console.log(`tempo: mediana ${(tempi[Math.floor(tempi.length / 2)] / 1000).toFixed(1)} s · massimo ${(tempi.at(-1)! / 1000).toFixed(1)} s`)

for (const e of esecuzioni) {
  const falliti = e.esiti.filter((x) => !x.superato)
  if (e.errore) console.log(`  ✗ ${e.caso} #${e.ripetizione}: ERRORE ${e.errore.slice(0, 200)}`)
  else if (falliti.length) console.log(`  ✗ ${e.caso} #${e.ripetizione}: ${falliti.map((x) => x.controllo).join(' · ')}`)
}

if (argomenti.dettagli) writeFileSync(argomenti.dettagli, JSON.stringify(esecuzioni, null, 2))
process.exitCode = superati === tutti.length ? 0 : 1
