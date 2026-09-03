import { arrotondaCentesimi } from '../calcolo'
import type { FrammentoTesto } from './frammenti'

export interface VoceComputo {
  numero: number
  tariffa: string | null
  categoria: string | null
  descrizione: string
  unita: string | null
  quantita: number | null
  prezzoUnitario: number | null
  totale: number | null
}

export interface CategoriaRiepilogo {
  nome: string
  importo: number
}

export interface Computo {
  voci: VoceComputo[]
  riepilogo: Record<string, CategoriaRiepilogo>
  totale: number
}

export interface EsitoIntegrita {
  coerente: boolean
  totaleRiepilogo: number
  totaleVoci: number
}

/**
 * Colonne della griglia Primus, in punti. Verificate su entrambi i computi:
 * la riga SOMMANO porta quantità, prezzo unitario e totale in tre fasce di
 * ascissa che non si sovrappongono. Sono l'unico modo di distinguerli, perché
 * come testo sono tre numeri indistinguibili.
 */
const COLONNA_QUANTITA = { da: 430, a: 485 }
const COLONNA_UNITARIO = { da: 486, a: 520 }
const COLONNA_TOTALE = { da: 535, a: Infinity }

const MARGINE_SINISTRO = 25
const COLONNA_DESCRIZIONE = { da: 55, a: 130 }
const FASCIA_CATEGORIA = { da: 100, a: 220 }

const SOLO_NUMERO = /^-?[\d´.]*\d(?:,\d+)?$/
const APERTURA_VOCE = /^(\d+)\s*\/\s*(\d+)\b/
const TARIFFA = /^(\d{3}\.\d{2}\.\d{2,3})\b\s*(.*)$/
const CATEGORIA = /^(.+?)\s+\(Cat \d+\)$/
const RIGA_RIEPILOGO = /^(M:\d{3}\.\d{3})\s+(.*?)\s+euro\s+([\d´.,]+)$/
const RIGA_SOMMANO = /^SOMMANO\s+(.+)$/

/**
 * I numeri di Primus usano la virgola decimale e, per le migliaia, l'apostrofo
 * tipografico `´` (U+00B4) — non l'apice ASCII. Cfr. CLAUDE.md.
 */
export function numeroItaliano(testo: string): number | null {
  if (!SOLO_NUMERO.test(testo)) return null
  const valore = Number.parseFloat(
    testo.replace(/´/g, '').replace(/\./g, '').replace(',', '.'),
  )
  return Number.isFinite(valore) ? valore : null
}

interface Riga {
  pagina: number
  y: number
  frammenti: FrammentoTesto[]
}

/**
 * Raggruppa i frammenti in righe visive. Due frammenti stanno sulla stessa riga
 * se distano meno di 2 punti in ordinata: dentro una riga di Primus le celle
 * hanno la stessa y a meno del rumore di rendering, e fra righe adiacenti la
 * distanza è di circa 6 punti.
 */
function raggruppaInRighe(frammenti: FrammentoTesto[]): Riga[] {
  const gruppi = new Map<string, FrammentoTesto[]>()
  for (const frammento of frammenti) {
    const chiave = `${frammento.pagina}|${Math.round(frammento.y / 2)}`
    const gruppo = gruppi.get(chiave)
    if (gruppo) gruppo.push(frammento)
    else gruppi.set(chiave, [frammento])
  }
  return [...gruppi.values()]
    .map((gruppo) => ({
      pagina: gruppo[0].pagina,
      y: gruppo[0].y,
      frammenti: [...gruppo].sort((a, b) => a.x - b.x),
    }))
    // y decrescente: nei PDF l'origine è in basso, la prima riga ha la y più alta
    .sort((a, b) => a.pagina - b.pagina || b.y - a.y)
}

export function estraiComputo(frammenti: FrammentoTesto[]): Computo {
  const voci: VoceComputo[] = []
  const riepilogo: Record<string, CategoriaRiepilogo> = {}
  let corrente: (VoceComputo & { righeDescrizione: string[] }) | null = null
  let categoria: string | null = null

  for (const riga of raggruppaInRighe(frammenti)) {
    const testo = riga.frammenti.map((f) => f.testo).join(' ')
    const primaX = riga.frammenti[0].x

    const inRiepilogo = testo.match(RIGA_RIEPILOGO)
    if (inRiepilogo) {
      const importo = numeroItaliano(inRiepilogo[3])
      if (importo !== null) {
        riepilogo[inRiepilogo[1]] = { nome: inRiepilogo[2], importo }
      }
      continue
    }

    const intestazione = testo.match(CATEGORIA)
    if (intestazione && primaX > FASCIA_CATEGORIA.da && primaX < FASCIA_CATEGORIA.a) {
      categoria = intestazione[1]
      continue
    }

    const apertura = testo.match(APERTURA_VOCE)
    if (apertura && primaX < MARGINE_SINISTRO) {
      const resto = testo.slice(apertura[0].length).trim()
      corrente = {
        numero: Number.parseInt(apertura[1], 10),
        tariffa: null,
        categoria,
        descrizione: '',
        righeDescrizione: resto ? [resto] : [],
        unita: null,
        quantita: null,
        prezzoUnitario: null,
        totale: null,
      }
      voci.push(corrente)
      continue
    }

    if (!corrente) continue

    const conTariffa = testo.match(TARIFFA)
    if (conTariffa && primaX < MARGINE_SINISTRO) {
      corrente.tariffa = conTariffa[1]
      if (conTariffa[2].trim()) corrente.righeDescrizione.push(conTariffa[2].trim())
      continue
    }

    const sommano = riga.frammenti.find((f) => RIGA_SOMMANO.test(f.testo))
    if (sommano) {
      corrente.unita = sommano.testo.match(RIGA_SOMMANO)![1]
      for (const frammento of riga.frammenti) {
        const valore = numeroItaliano(frammento.testo)
        if (valore === null) continue
        const { x } = frammento
        if (x >= COLONNA_QUANTITA.da && x <= COLONNA_QUANTITA.a) corrente.quantita = valore
        else if (x >= COLONNA_UNITARIO.da && x <= COLONNA_UNITARIO.a) corrente.prezzoUnitario = valore
        else if (x >= COLONNA_TOTALE.da) corrente.totale = valore
      }
      continue
    }

    // Righe di descrizione che proseguono, e righe "Vedi voce n° N" che Primus
    // usa per riportare quantità da altre voci: entrambe stanno nella colonna
    // della descrizione e valgono solo finché la voce non è chiusa da SOMMANO.
    if (
      corrente.unita === null &&
      primaX >= COLONNA_DESCRIZIONE.da &&
      primaX <= COLONNA_DESCRIZIONE.a
    ) {
      corrente.righeDescrizione.push(testo)
    }
  }

  for (const voce of voci) {
    const conRighe = voce as VoceComputo & { righeDescrizione: string[] }
    voce.descrizione = conRighe.righeDescrizione.join(' ').replace(/\s+/g, ' ').trim()
    delete (conRighe as { righeDescrizione?: string[] }).righeDescrizione
  }

  const totale = arrotondaCentesimi(
    Object.values(riepilogo).reduce((somma, categoria) => somma + categoria.importo, 0),
  )
  return { voci, riepilogo, totale }
}

/**
 * La somma dei totali di voce deve pareggiare il totale del riepilogo. Se non
 * pareggia l'estrazione ha perso o duplicato qualcosa, e va detto: un conteggio
 * su un computo letto male produrrebbe numeri plausibili e sbagliati.
 */
export function verificaIntegrita(computo: Computo): EsitoIntegrita {
  const totaleVoci = arrotondaCentesimi(
    computo.voci.reduce((somma, voce) => somma + (voce.totale ?? 0), 0),
  )
  return { coerente: totaleVoci === computo.totale, totaleRiepilogo: computo.totale, totaleVoci }
}
