import { CATEGORIE_SERRAMENTO, type CategoriaSerramento, type Serramento } from './geometria'

// Una cella così come la restituisce un lettore xlsx con {header: 1}: array di righe,
// ogni riga un array di celle a partire dalla colonna A (indice 0).
export type Cella = string | number | null | undefined
export type Riga = Cella[]

export interface Parete {
  n: number
  tipo: 'I' | 'E'
  b: number
  h: number
  spessore: number
}

// Copertura e travi usano notazioni compatte non standardizzate ("5,8x16,5 x17,1",
// "(2)2,7+4,15+(4)2,6+3,8x0,2x0,20"). Non entrano nel motore di calcolo (§3 CLAUDE.md
// parla solo di geometria/listino/voci) quindi si conserva la forma scritta com'è, senza
// tentare di interpretarla in numeri — stessa scelta già fatta per le superfici per piano.
export interface VoceGeometricaLibera {
  etichetta: string
  notazione: string
}

export interface RisultatoImportazioneExcel {
  serramenti: Serramento[]
  pareti: Parete[]
  falde: VoceGeometricaLibera[]
  travi: VoceGeometricaLibera[]
  avvisi: string[]
}

const COL = { N: 2, PIANO: 3, TIPOLOGIA: 4, B: 6, H: 7 } as const
const COL_PARETI = { N: 2, TIPO: 3, B: 4, H: 5, SP: 6 } as const
const COL_FALDE = { N: 2, ETICHETTA: 3, NOTAZIONE: 5 } as const
const COL_TRAVI = { ETICHETTA: 2, NOTAZIONE: 5 } as const
const COL_COPERTURA_TOTALE_LORDA = 11

function testoCella(cella: Cella): string {
  if (cella === null || cella === undefined) return ''
  // Una cella numerica "pura" (es. Grondaia: 45,6 ml, senza notazione composta) può essere
  // salvata con rumore in virgola mobile (45.599999999999994): non è la forma scritta
  // dall'operatore, è un artefatto del formato file, quindi qui va ripulito.
  if (typeof cella === 'number') return String(Math.round(cella * 100) / 100)
  return String(cella).trim()
}

function numeroCella(cella: Cella): number | null {
  if (typeof cella === 'number') return cella
  if (typeof cella === 'string' && cella.trim() !== '') {
    const valore = Number.parseFloat(cella.replace(',', '.'))
    return Number.isNaN(valore) ? null : valore
  }
  return null
}

function trovaRiga(righe: Riga[], daIndice: number, previsto: string): number {
  for (let i = daIndice; i < righe.length; i++) {
    if (testoCella(righe[i]?.[2]).toUpperCase() === previsto) return i
  }
  return -1
}

// Ogni sezione va letta solo fino all'inizio della sezione successiva: senza questo limite
// un ciclo che si ferma solo su "riga vuota" finisce per interpretare le righe della
// sezione dopo (es. PARETI) come ulteriori dati della sezione prima (es. COPERTURA).
function fineSezione(inizio: number, altreSezioni: number[], lunghezzaTotale: number): number {
  const successive = altreSezioni.filter((indice) => indice > inizio)
  return successive.length === 0 ? lunghezzaTotale : Math.min(...successive)
}

function mappaCategoria(tipologia: string): { categoria: CategoriaSerramento; riconosciuta: boolean } {
  const t = tipologia.toLowerCase()
  if (t.includes('portafinestra')) return { categoria: 'portafinestra-battente', riconosciuta: true }
  if (t.includes('porta')) return { categoria: 'portoncino', riconosciuta: true }
  if (t.includes('finestra')) return { categoria: 'finestra-battente', riconosciuta: true }
  if (t.includes('scorrevole') || t.includes('alzante')) return { categoria: 'alzante-scorrevole', riconosciuta: true }
  if (t.includes('fisso') || t.includes('vetrata')) return { categoria: 'fisso-vetrata', riconosciuta: true }
  return { categoria: CATEGORIE_SERRAMENTO[0], riconosciuta: false }
}

function estraiSerramenti(righe: Riga[], indiceSezione: number, fine: number, avvisi: string[]): Serramento[] {
  const serramenti: Serramento[] = []
  for (let i = indiceSezione; i < fine; i++) {
    const riga = righe[i] ?? []
    const n = numeroCella(riga[COL.N])
    if (n === null) continue
    const piano = testoCella(riga[COL.PIANO])
    const tipologia = testoCella(riga[COL.TIPOLOGIA])
    const b = numeroCella(riga[COL.B]) ?? 0
    const h = numeroCella(riga[COL.H]) ?? 0
    const { categoria, riconosciuta } = mappaCategoria(tipologia)
    if (!riconosciuta) {
      avvisi.push(`Tipologia serramento non riconosciuta "${tipologia}" (n. ${n}): impostata categoria di default "${categoria}", da correggere.`)
    }
    serramenti.push({ n, piano, tipologia, categoria, b, h })
  }
  return serramenti
}

function estraiPareti(righe: Riga[], indiceSezione: number, fine: number): Parete[] {
  const pareti: Parete[] = []
  for (let i = indiceSezione; i < fine; i++) {
    const riga = righe[i] ?? []
    const n = numeroCella(riga[COL_PARETI.N])
    if (n === null) continue
    const tipoTesto = testoCella(riga[COL_PARETI.TIPO])
    if (tipoTesto !== 'I' && tipoTesto !== 'E') continue
    pareti.push({
      n,
      tipo: tipoTesto,
      b: numeroCella(riga[COL_PARETI.B]) ?? 0,
      h: numeroCella(riga[COL_PARETI.H]) ?? 0,
      spessore: numeroCella(riga[COL_PARETI.SP]) ?? 0,
    })
  }
  return pareti
}

function estraiVociLibereCopertura(righe: Riga[], indiceSezione: number, fine: number): VoceGeometricaLibera[] {
  const voci: VoceGeometricaLibera[] = []
  for (let i = indiceSezione; i < fine; i++) {
    const riga = righe[i] ?? []
    const n = numeroCella(riga[COL_FALDE.N])
    const etichetta = testoCella(riga[COL_FALDE.ETICHETTA])
    if (n === null || etichetta === '') continue
    const notazione = testoCella(riga[COL_FALDE.NOTAZIONE])
    voci.push({ etichetta, notazione })
  }
  return voci
}

function estraiVociLibereTravi(righe: Riga[], indiceSezione: number, fine: number): VoceGeometricaLibera[] {
  const voci: VoceGeometricaLibera[] = []
  for (let i = indiceSezione; i < fine; i++) {
    const riga = righe[i] ?? []
    const etichetta = testoCella(riga[COL_TRAVI.ETICHETTA])
    const notazione = testoCella(riga[COL_TRAVI.NOTAZIONE])
    if (etichetta === '' || notazione === '') continue
    voci.push({ etichetta, notazione })
  }
  return voci
}

function arrotonda2(valore: number): number {
  return Math.round(valore * 100) / 100
}

function verificaTotaliCopertura(righe: Riga[], serramenti: Serramento[], avvisi: string[]): void {
  const indiceCopertura = trovaRiga(righe, 0, 'COPERTURA')
  if (indiceCopertura === -1) return
  const rigaCopertura = righe[indiceCopertura] ?? []
  const lordaDichiarata = numeroCella(rigaCopertura[COL_COPERTURA_TOTALE_LORDA])
  if (lordaDichiarata === null) return

  const lordaRicalcolata = arrotonda2(serramenti.reduce((somma, s) => somma + s.b * s.h, 0))
  if (Math.abs(lordaRicalcolata - lordaDichiarata) > 0.01) {
    avvisi.push(
      `Il totale mq lordi ricalcolato dai serramenti (${lordaRicalcolata}) non coincide con quello dichiarato nel foglio (${lordaDichiarata}).`,
    )
  }
}

// Interpreta le righe di "Conteggi pulito.xlsx" (o di un file con lo stesso layout: sezioni
// SERRAMENTI / COPERTURA / TRAVI / PARETI, in quest'ordine). Le sezioni assenti producono
// array vuoti, mai un errore: il foglio può non avere tutte le sezioni.
export function importaConteggiExcel(righe: Riga[]): RisultatoImportazioneExcel {
  const avvisi: string[] = []

  const indiceSerramenti = trovaRiga(righe, 0, 'SERRAMENTI')
  const indiceCopertura = trovaRiga(righe, 0, 'COPERTURA')
  const indiceTravi = trovaRiga(righe, 0, 'TRAVI')
  const indicePareti = trovaRiga(righe, 0, 'PARETI')
  const tutteLeSezioni = [indiceSerramenti, indiceCopertura, indiceTravi, indicePareti].filter((i) => i !== -1)

  const serramenti =
    indiceSerramenti === -1
      ? []
      : estraiSerramenti(righe, indiceSerramenti, fineSezione(indiceSerramenti, tutteLeSezioni, righe.length), avvisi)
  if (indiceSerramenti !== -1) verificaTotaliCopertura(righe, serramenti, avvisi)

  const falde =
    indiceCopertura === -1
      ? []
      : estraiVociLibereCopertura(righe, indiceCopertura, fineSezione(indiceCopertura, tutteLeSezioni, righe.length))

  const travi =
    indiceTravi === -1 ? [] : estraiVociLibereTravi(righe, indiceTravi, fineSezione(indiceTravi, tutteLeSezioni, righe.length))

  const pareti =
    indicePareti === -1 ? [] : estraiPareti(righe, indicePareti, fineSezione(indicePareti, tutteLeSezioni, righe.length))

  return { serramenti, pareti, falde, travi, avvisi }
}
