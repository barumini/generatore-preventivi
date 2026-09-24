import type { CampiEstratti } from './estrazione'
import {
  CATEGORIE_SERRAMENTO,
  PIANI_CANONICI,
  normalizzaNomePiano,
  type CategoriaSerramento,
} from '@/domain/geometria'

// Strato deterministico dell'estrazione. Il modello risponde con JSON libero (json_object,
// nessuno schema vincolato: misurato, con la decodifica vincolata e le chiavi facoltative il
// modello "salta" chiavi e finisce in rami sbagliati, es. spessori dentro "travi"). Le regole
// di dominio che un modello a ragionamento spento non rispetta sempre si applicano qui, in
// codice: niente valori senza riscontro nel testo (l'AI non inventa), unità tolte ma forma
// scritta conservata ("13+14"), piani canonici, elementi incompleti scartati, ultima menzione
// vince, campiMancanti calcolati qui e mai chiesti al modello. TypeScript puro: nessuna rete.

export type Grezzo = Record<string, unknown>

// Tollera recinzioni markdown o testo attorno all'oggetto: prende dalla prima "{" all'ultima "}".
export function parsaJsonTollerante(grezzo: string): unknown {
  const testo = grezzo.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(testo)
  } catch {
    const inizio = testo.indexOf('{')
    const fine = testo.lastIndexOf('}')
    if (inizio === -1 || fine <= inizio) throw new Error(`risposta non JSON: ${grezzo.slice(0, 120)}`)
    return JSON.parse(testo.slice(inizio, fine + 1))
  }
}

export const CHIAVI_ATTESE = [
  'cliente', 'protocollo', 'progettista', 'luogo', 'superfici', 'tipoCopertura', 'finituraEsterna', 'pacchetto',
  'spessoreEsterno', 'spessoreInterno', 'spessoreCoibente', 'spessoreCappotto', 'pareti', 'falde', 'travi', 'serramenti',
] as const

// Un JSON sintatticamente valido ma con una forma diversa da quella chiesta (chiavi inventate,
// "cliente" come stringa, superfici come oggetto) è il segno che il fornitore non ha passato
// al modello le istruzioni: meglio un nuovo tentativo che un'estrazione vuota in silenzio.
export function controllaForma(oggetto: unknown): Grezzo {
  if (typeof oggetto !== 'object' || oggetto === null || Array.isArray(oggetto)) throw new Error('la risposta non è un oggetto JSON')
  let o = oggetto as Grezzo
  // Oggetto avvolto in una chiave radice ({"preventivo": {...}}): lo si scarta.
  const valori = Object.values(o)
  if (!('cliente' in o) && valori.length === 1 && typeof valori[0] === 'object' && valori[0] !== null && 'cliente' in valori[0]) {
    o = valori[0] as Grezzo
  }
  if (typeof o.cliente !== 'object' || o.cliente === null || Array.isArray(o.cliente)) {
    throw new Error('"cliente" deve essere un oggetto {"nome","comune","provincia"}')
  }
  if (!Array.isArray(o.superfici)) throw new Error('"superfici" deve essere una lista [{"piano","valoreLordo"}]')
  const assenti = CHIAVI_ATTESE.filter((k) => !(k in o))
  if (assenti.length > 3) throw new Error(`mancano le chiavi ${assenti.join(', ')}`)
  return o
}

// Un nome cliente che non compare affatto nel testo vuol dire che il modello ha risposto ad
// altro (es. ha ripetuto un esempio): nuovo tentativo invece di un'anagrafica falsa. Va chiamata
// dopo controllaForma, che garantisce "cliente" oggetto.
export function verificaNomeCliente(oggetto: Grezzo, testo: string): void {
  const nome = stringa((oggetto.cliente as Grezzo).nome)
  if (nome && !nome.toLowerCase().split(/[^\p{L}]+/u).some((p) => p.length >= 2 && testo.toLowerCase().includes(p))) {
    throw new Error(`il cliente "${nome.slice(0, 60)}" non compare nel testo`)
  }
}

// ---------------------------------------------------------------------------------------
// Letture tolleranti dei valori grezzi
// ---------------------------------------------------------------------------------------

const VALORI_VUOTI = new Set(['', 'null', 'n/d', 'nd', 'n.d.', 'non specificato', 'non indicato', 'undefined', '-'])

function stringa(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return VALORI_VUOTI.has(s.toLowerCase()) ? undefined : s
}

function numero(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const s = stringa(v)
  if (!s) return undefined
  const m = s.replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  return m ? Number.parseFloat(m[0]) : undefined
}

function lista(v: unknown): Grezzo[] {
  return Array.isArray(v) ? v.filter((x): x is Grezzo => typeof x === 'object' && x !== null) : []
}

const NUMERI_A_PAROLE: Record<string, number> = {
  // "un/uno/una" esclusi: sono quasi sempre articoli ("una finestra") e darebbero un falso riscontro a 1.
  due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
}

function numeriDelTesto(testo: string): number[] {
  const numeri = [...testo.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number.parseFloat(m[0].replace(',', '.')))
  for (const parola of testo.toLowerCase().match(/\p{L}+/gu) ?? []) {
    if (parola in NUMERI_A_PAROLE) numeri.push(NUMERI_A_PAROLE[parola])
  }
  return numeri
}

// "L'AI non inventa valori": un numero è accettato solo se compare nel testo, eventualmente
// in un'altra unità (scale: es. metri scritti in cm o mm).
function haRiscontro(valore: number, numeri: number[], scale: number[]): boolean {
  return scale.some((k) => numeri.some((n) => Math.abs(n - valore * k) < 1e-6 * Math.max(1, n)))
}

function numeriDellaStringa(s: string): number[] {
  return [...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number.parseFloat(m[0].replace(',', '.')))
}

const UNITA_SUPERFICIE = /\s*(?:mq|m²|m2|metri\s+quadr(?:ati|i)|m\.q\.)\.?(?=\s|\+|$)/gi
const UNITA_SPESSORE = /\s*(?:mm|millimetri)\.?(?=\s|\+|-|$)/gi

// Un nome che non si riconosce resta com'è scritto: il form lo mostra da correggere (vedi
// normalizzaNomePiano) e campiMancanti lo segnala.
function pianoCanonico(valore: string): string {
  const diretto = normalizzaNomePiano(valore)
  if ((PIANI_CANONICI as readonly string[]).includes(diretto)) return diretto
  const s = valore.toLowerCase().replace(/[^\p{L}\p{N}°]+/gu, ' ').trim()
  if (/sottotett|mansard|soffitt/.test(s)) return 'Piano sottotetto'
  if (/garage|\bbox\b|autorimess/.test(s)) return 'Garage'
  if (/portic/.test(s)) return 'Portico'
  if (/terrazz/.test(s)) return 'Terrazzo'
  if (/\bprimo\b|\b1\s*°|\bp\s*1\b/.test(s)) return 'Piano Primo'
  if (/\bterra\b|terreno|pianterreno|pianoterra|^p\s*t$|^pt$/.test(s)) return 'Piano Terra'
  return valore.trim()
}

// La categoria del modello, se valida, prevale: il modello legge tutta la conversazione
// ("la portafinestra la facciamo alzante scorrevole"), la tipologia è solo un'etichetta breve.
// La tipologia serve da ripiego quando la categoria manca o non è tra quelle ammesse.
function categoriaDa(tipologia: string, categoriaModello: unknown): CategoriaSerramento | undefined {
  const dalModello = stringa(categoriaModello)
  if (dalModello && (CATEGORIE_SERRAMENTO as readonly string[]).includes(dalModello)) return dalModello as CategoriaSerramento
  const t = tipologia.toLowerCase()
  if (/scorrevol|alzante/.test(t)) return 'alzante-scorrevole'
  if (/porta\s*-?\s*finestr|portafinestr/.test(t)) return 'portafinestra-battente'
  if (/\bfiss|vetrat/.test(t)) return 'fisso-vetrata'
  if (/portoncin|\bporta\b|ingresso/.test(t)) return 'portoncino'
  if (/finestr/.test(t)) return 'finestra-battente'
  return undefined
}

function copertura(v: unknown): 'piano' | 'falde' | undefined {
  const s = stringa(v)?.toLowerCase()
  if (!s) return undefined
  if (/fald|capanna|acque|inclinat|spiovent/.test(s)) return 'falde'
  if (/pian/.test(s)) return 'piano'
  return undefined
}

function finitura(v: unknown): 'intonaco' | 'rivestimento' | undefined {
  const s = stringa(v)?.toLowerCase()
  if (!s) return undefined
  if (/intonac/.test(s)) return 'intonaco'
  if (/rivest/.test(s)) return 'rivestimento'
  return undefined
}

function pacchetto(v: unknown): 'grezzo' | 'grezzo avanzato' | 'chiavi in mano' | undefined {
  const s = stringa(v)?.toLowerCase()
  if (!s) return undefined
  if (/chiavi/.test(s)) return 'chiavi in mano'
  if (/avanzat/.test(s)) return 'grezzo avanzato'
  if (/grezz/.test(s)) return 'grezzo'
  return undefined
}

const NOMI_SPESSORI = /^(?:spessore\s*)?(?:parete\s*)?(?:pareti\s*)?(esterno|esterna|esterne|interno|interna|interne|coibente|isolante|cappotto)$/i

// ---------------------------------------------------------------------------------------
// Normalizzazione
// ---------------------------------------------------------------------------------------

// Riceve la risposta grezza già passata da controllaForma. Il risultato rispetta sempre
// SchemaCampiEstratti: estraiCampi lo rivalida comunque come rete di sicurezza.
export function normalizzaEstrazione(g: Grezzo, testo: string): CampiEstratti {
  const numeri = numeriDelTesto(testo)
  const cliente = (typeof g.cliente === 'object' && g.cliente !== null ? g.cliente : {}) as Grezzo

  // Protocollo: deve comparire nel testo (a meno di spazi e punteggiatura).
  const alfanumerico = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  let protocollo = stringa(g.protocollo)
  if (protocollo && !alfanumerico(testo).includes(alfanumerico(protocollo))) protocollo = undefined

  // Progettista: almeno una parola del nome (esclusi i titoli) deve comparire nel testo.
  let progettista = stringa(g.progettista)
  if (progettista) {
    const parole = progettista
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .filter((p) => p.length >= 3 && !/^(arch|ing|geom|dott|dottor|studio|progettista|per)$/.test(p))
    const intero = testo.toLowerCase().replace(/\s+/g, ' ').includes(progettista.toLowerCase().replace(/\s+/g, ' '))
    if (!intero && !parole.some((p) => testo.toLowerCase().includes(p))) progettista = undefined
  }

  // Spessori: stringa del solo numero come scritto; ogni numero deve comparire nel testo.
  const spessore = (v: unknown): string | undefined => {
    const s = stringa(v)?.replace(UNITA_SPESSORE, '').trim()
    if (!s || !/\d/.test(s)) return undefined
    return numeriDellaStringa(s).every((n) => haRiscontro(n, numeri, [1, 0.1])) ? s : undefined
  }
  let spessoreEsterno = spessore(g.spessoreEsterno)
  let spessoreInterno = spessore(g.spessoreInterno)
  let spessoreCoibente = spessore(g.spessoreCoibente)
  let spessoreCappotto = spessore(g.spessoreCappotto)

  // Falde/travi: niente spessori travestiti (li recupera se il campo giusto è vuoto), niente
  // "copertura a falde" come falda, numeri della notazione presenti nel testo.
  const voceLibera = (voce: Grezzo): { etichetta: string; notazione: string } | undefined => {
    const etichetta = stringa(voce.etichetta)
    const notazione = stringa(voce.notazione)
    if (!etichetta || !notazione) return undefined
    const nome = etichetta.toLowerCase().trim().match(NOMI_SPESSORI)?.[1]
    if (nome) {
      const valore = spessore(notazione)
      if (valore) {
        if (/^estern/.test(nome)) spessoreEsterno ??= valore
        else if (/^intern/.test(nome)) spessoreInterno ??= valore
        else if (/coibente|isolante/.test(nome)) spessoreCoibente ??= valore
        else if (nome === 'cappotto') spessoreCappotto ??= valore
      }
      return undefined
    }
    const soloTipo = notazione
      .toLowerCase()
      .replace(/\b(a|due|doppia|quattro|falde|falda|copertura|tetto|piano|piana|inclinata|capanna|acque)\b/g, '')
      .trim()
    if (soloTipo === '') return undefined
    if (!numeriDellaStringa(notazione).every((n) => haRiscontro(n, numeri, [1]))) return undefined
    return { etichetta, notazione }
  }
  const falde = /fald|copertur|tetto/i.test(testo)
    ? lista(g.falde).map(voceLibera).filter((x) => x !== undefined)
    : []
  const travi = /trav/i.test(testo) ? lista(g.travi).map(voceLibera).filter((x) => x !== undefined) : []

  // Superfici: piano canonico, valore come scritto senza unità, ultima menzione vince.
  const perPiano = new Map<string, { piano: string; valoreLordo: string }>()
  for (const voce of lista(g.superfici)) {
    const pianoScritto = stringa(voce.piano)
    const valore = stringa(voce.valoreLordo)?.replace(UNITA_SUPERFICIE, '').trim()
    if (!pianoScritto || !valore || !/\d/.test(valore)) continue
    const piano = pianoCanonico(pianoScritto)
    perPiano.delete(piano)
    perPiano.set(piano, { piano, valoreLordo: valore })
  }
  const superfici = [...perPiano.values()]

  // Serramenti: tutti i dati presenti e con riscontro nel testo, altrimenti omesso.
  const serramenti = lista(g.serramenti)
    .map((s) => {
      const piano = stringa(s.piano)
      const tipologia = stringa(s.tipologia)
      const b = numero(s.b)
      const h = numero(s.h)
      if (!piano || !tipologia || b === undefined || h === undefined || b <= 0 || h <= 0) return undefined
      const categoria = categoriaDa(tipologia, s.categoria)
      if (!categoria) return undefined
      if (!haRiscontro(b, numeri, [1, 100, 1000]) || !haRiscontro(h, numeri, [1, 100, 1000])) return undefined
      return { piano: pianoCanonico(piano), tipologia, categoria, b, h }
    })
    .filter((x) => x !== undefined)
    .map((s, i) => ({ n: i + 1, ...s }))

  // Pareti: stesso criterio.
  const pareti = lista(g.pareti)
    .map((p) => {
      const tipoScritto = stringa(p.tipo)?.toLowerCase()
      const tipo = tipoScritto === 'e' || tipoScritto?.startsWith('est') ? 'E' : tipoScritto === 'i' || tipoScritto?.startsWith('int') ? 'I' : undefined
      const b = numero(p.b)
      const h = numero(p.h)
      const sp = numero(p.spessore)
      if (!tipo || b === undefined || h === undefined || sp === undefined || b <= 0 || h <= 0 || sp <= 0) return undefined
      if (!haRiscontro(b, numeri, [1, 100, 1000]) || !haRiscontro(h, numeri, [1, 100, 1000])) return undefined
      if (!haRiscontro(sp, numeri, [1, 0.1, 0.001])) return undefined
      return { tipo: tipo as 'E' | 'I', b, h, spessore: sp }
    })
    .filter((x) => x !== undefined)
    .map((p, i) => ({ n: i + 1, ...p }))

  const campi: CampiEstratti = {
    cliente: {
      nome: stringa(cliente.nome) ?? '',
      ...(stringa(cliente.comune) ? { comune: stringa(cliente.comune) } : {}),
      ...(stringa(cliente.provincia) ? { provincia: stringa(cliente.provincia) } : {}),
    },
    superfici,
    campiMancanti: [],
  }
  if (protocollo) campi.protocollo = protocollo
  if (progettista) campi.progettista = progettista
  const luogo = stringa(g.luogo)
  if (luogo) campi.luogo = luogo
  const tc = copertura(g.tipoCopertura)
  if (tc) campi.tipoCopertura = tc
  const fe = finitura(g.finituraEsterna)
  if (fe) campi.finituraEsterna = fe
  const pk = pacchetto(g.pacchetto)
  if (pk) campi.pacchetto = pk
  if (spessoreEsterno) campi.spessoreEsterno = spessoreEsterno
  if (spessoreInterno) campi.spessoreInterno = spessoreInterno
  if (spessoreCoibente) campi.spessoreCoibente = spessoreCoibente
  if (spessoreCappotto) campi.spessoreCappotto = spessoreCappotto
  if (pareti.length) campi.pareti = pareti
  if (falde.length) campi.falde = falde
  if (travi.length) campi.travi = travi
  if (serramenti.length) campi.serramenti = serramenti

  // campiMancanti calcolati in codice: i campi del preventivo rimasti vuoti, più i piani non
  // riconosciuti (da correggere a mano). "luogo" mai: si deduce dal comune.
  const mancanti: string[] = []
  if (!campi.cliente.nome) mancanti.push('cliente.nome')
  if (!campi.cliente.comune) mancanti.push('cliente.comune')
  if (!campi.cliente.provincia) mancanti.push('cliente.provincia')
  for (const chiave of [
    'protocollo',
    'progettista',
    'tipoCopertura',
    'finituraEsterna',
    'pacchetto',
    'spessoreEsterno',
    'spessoreInterno',
    'spessoreCoibente',
    'spessoreCappotto',
  ] as const) {
    if (!campi[chiave]) mancanti.push(chiave)
  }
  if (superfici.length === 0) mancanti.push('superfici')
  for (const s of superfici) {
    if (!(PIANI_CANONICI as readonly string[]).includes(s.piano)) mancanti.push(s.piano)
  }
  campi.campiMancanti = mancanti
  return campi
}
