import fs from 'node:fs'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import type { RisultatoCalcolo, VoceValorizzata } from '@/domain/calcolo'
import { formattaImportoItaliano } from './preview/formattazione'
import { righeVoci, segnoArrotondamento, formattaPercentuale } from './tabella-prezzi'

const SISTEMA_COSTRUTTIVO = 'MassivHolzMauer® (M.H.M.)'

export interface CaratteristicheOfferta {
  tetto: string
  mantoCopertura: string
  finituraEsterna: string
  pacchettoConsegna: string
}

export interface SuperficiOfferta {
  totaleLorda: string // stringa libera, es. '134+13+14= 161' — CLAUDE.md: forma scritta conservata
  pianoTerra: string
  pianoPrimo: string
  sottotetto: string
  portico: string
  terrazzo: string
  garage: string
}

export interface VoceOpzionale {
  id: string // usato solo per {riferimenti.praticaGenioCivile} — mai stampato a schermo
  lettera: string
  descrizione: string
  // review Task 17 (Finding 3): PLACEHOLDER.md documenta anche importi testuali liberi non
  // enumerabili (es. "€ 35,00/ora" per un'esclusione a rapporto orario) — un'unione chiusa di
  // stringhe fisse renderebbe questo caso reale inesportabile.
  importo: number | string
}

export interface SalRata {
  percentuale: number
  descrizione: string
}

export interface CondizioniOfferta {
  optional: VoceOpzionale[]
  esclusioni: VoceOpzionale[]
  consegna: string
  caparra: number
  salPrimi: SalRata[] // i primi 3 SAL, prima della clausola di fidejussione
  salSuccessivi: SalRata[]
  validita: string
}

export interface AbacoPerCategoria {
  tutti: string
  finestreBattente: string
  portefinestreBattente: string
  fissiVetrate: string
  alzantiScorrevoli: string
  portoncini: string
}

export interface InputEsportazione {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  revisione: string // 2 cifre, es. '00'
  dataOfferta: string
  risultato: RisultatoCalcolo
  annoListino: number
  caratteristiche: CaratteristicheOfferta
  superfici: SuperficiOfferta
  condizioni: CondizioniOfferta
  abaco: AbacoPerCategoria
  percorsoMaster: string
  percorsoOutput: string
  /**
   * Opt-in esplicito, di default assente/false. Alcune `descrizioneTemplate` del catalogo
   * (`src/domain/voci.ts`) contengono placeholder testuali a doppia graffa mai interpolati da
   * nessun meccanismo esistente (es. `{{spessoreEsterno}}`) — vedi
   * `rilevaPlaceholderSpessoreNonInterpolati` sotto e `template/PLACEHOLDER.md`. Senza questo
   * flag `esportaOfferta` si blocca per non produrre in silenzio un documento con un residuo di
   * sviluppo dentro una cella che il cliente firma. Il vero fix (nuovi campi di dominio +
   * interpolazione + raccolta dati nel wizard) è un follow-up dichiarato, non risolto qui.
   */
  consentiPlaceholderNonRisolti?: boolean
}

function formattaNumeroItaliano(valore: number): string {
  return formattaImportoItaliano(valore).replace(' €', '')
}

function formattaVoceOpzionale(v: VoceOpzionale) {
  return { lettera: v.lettera, descrizione: v.descrizione, importo: formattaImportoItaliano(v.importo) }
}

const PATTERN_PLACEHOLDER_DOPPIA_GRAFFA = /\{\{[^{}]+\}\}/g

/**
 * Cerca, nelle descrizioni delle voci di catalogo, placeholder a doppia graffa (es.
 * `{{spessoreEsterno}}`) che nessun meccanismo del progetto interpola oggi — non tag
 * docxtemplater (quelli sono a graffa singola), ma testo letterale rimasto nel dato di
 * dominio. Esportata anche per il test: la review di Task 17 chiede che l'insieme esatto dei
 * token rilevati sia verificato, così una correzione parziale in futuro fa fallire un test
 * invece di passare inosservata.
 */
export function rilevaPlaceholderSpessoreNonInterpolati(voci: VoceValorizzata[]): string[] {
  const trovati: string[] = []
  for (const v of voci) {
    const match = v.descrizione.match(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA)
    if (match) trovati.push(...match)
  }
  return trovati
}

export function esportaOfferta(input: InputEsportazione): void {
  const { vociGrezzo, vociPostSconto } = righeVoci(input.risultato)

  const placeholderSpessore = rilevaPlaceholderSpessoreNonInterpolati([...vociGrezzo, ...vociPostSconto])
  if (placeholderSpessore.length > 0 && !input.consentiPlaceholderNonRisolti) {
    throw new Error(
      `esportaOfferta: descrizioni con placeholder di spessore non interpolati: ${[...new Set(placeholderSpessore)].join(', ')}. ` +
        `Questo documento non è pronto per un cliente reale (nessun meccanismo di interpolazione, cfr. template/PLACEHOLDER.md). ` +
        `Passa consentiPlaceholderNonRisolti: true solo se accetti consapevolmente il residuo.`,
    )
  }

  const contenuto = fs.readFileSync(input.percorsoMaster, 'binary')
  const zip = new PizZip(contenuto)

  // review Task 17 (Finding 1): il nullGetter di default (o uno che restituisce sempre '')
  // rende un refuso nella chiave passata a render() indistinguibile da un campo vuoto
  // legittimo — la cella si svuota in silenzio in un documento firmato dal cliente. Qui invece
  // ogni tag semplice non risolto (part.module assente: i cicli con dato mancante sono
  // legittimi, cfr. PLACEHOLDER.md "un dato mancante è già equivalente a lista vuota") viene
  // registrato e fa fallire l'export con un errore leggibile.
  const chiaviNonRisolte: string[] = []
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part: { value: string; module?: string }) => {
      if (!part.module) chiaviNonRisolte.push(part.value)
      return ''
    },
  })

  // riferimenti.* non sono mai testo fisso (vincolo 4): si ricalcolano da vociValorizzate/optional ad ogni render
  const numeroVoce = (id: string) => input.risultato.vociValorizzate.find((v) => v.id === id)?.numero ?? ''
  // il testo fisso del master aggiunge già la ')' di chiusura dopo il tag
  // ("...quotato al punto {riferimenti.praticaGenioCivile}) optional)."), mentre in tabella
  // prezzi {lettera} è stampato per intero (es. "A)") — qui serve solo la lettera nuda.
  const letteraOptional = (id: string) => (input.condizioni.optional.find((v) => v.id === id)?.lettera ?? '').replace(/\)\s*$/, '')

  const segno = segnoArrotondamento(input.risultato.arrotondamento)
  const arrotondamentoTesto = `${segno} ${formattaImportoItaliano(Math.abs(input.risultato.arrotondamento))}`

  doc.render({
    'cliente.nome': input.cliente.nome,
    'cliente.comune': input.cliente.comune,
    'cliente.provincia': input.cliente.provincia,
    protocollo: input.protocollo,
    revisione: input.revisione,
    dataOfferta: input.dataOfferta,
    sistemaCostruttivo: SISTEMA_COSTRUTTIVO,
    tetto: input.caratteristiche.tetto,
    mantoCopertura: input.caratteristiche.mantoCopertura,
    finituraEsterna: input.caratteristiche.finituraEsterna,
    pacchettoConsegna: input.caratteristiche.pacchettoConsegna,
    'superficie.totaleLorda': input.superfici.totaleLorda,
    'superficie.pianoTerra': input.superfici.pianoTerra,
    'superficie.pianoPrimo': input.superfici.pianoPrimo,
    'superficie.sottotetto': input.superfici.sottotetto,
    'superficie.portico': input.superfici.portico,
    'superficie.terrazzo': input.superfici.terrazzo,
    'superficie.garage': input.superfici.garage,
    annoListino: String(input.annoListino),
    voci: vociGrezzo.map((v) => ({ numero: v.numero, descrizione: v.descrizione, importo: formattaImportoItaliano(v.importo) })),
    listinoTotale: formattaImportoItaliano(input.risultato.listinoTotale),
    sconti: input.risultato.sconti.map((s) => ({
      percentuale: formattaPercentuale(s.percentuale),
      causale: s.causale,
      // segno separato da uno spazio, come PLACEHOLDER.md ("- 23 700,00 €") e PaginaPrezzi.tsx:
      // formattaImportoItaliano(-s.importoCalcolato) incollerebbe il segno al numero ("-23 700,00 €")
      importo: `- ${formattaImportoItaliano(s.importoCalcolato)}`,
    })),
    arrotondamento: arrotondamentoTesto,
    parziale: formattaImportoItaliano(input.risultato.parziale),
    'sicurezza.valorizzata': formattaImportoItaliano(input.risultato.sicurezza.valorizzata),
    vociPostSconto: vociPostSconto.map((v) => ({ numero: v.numero, descrizione: v.descrizione, importo: formattaImportoItaliano(v.importo) })),
    totaleNetto: formattaImportoItaliano(input.risultato.totaleNetto),
    optional: input.condizioni.optional.map(formattaVoceOpzionale),
    esclusioni: input.condizioni.esclusioni.map(formattaVoceOpzionale),
    'riferimenti.praticaGenioCivile': letteraOptional('pratica-genio-civile'),
    'riferimenti.tracciamentoImpianti': numeroVoce('tracciamento-impianti'),
    'riferimenti.progettazioneEsecutiva': numeroVoce('progettazione-esecutiva'),
    consegna: input.condizioni.consegna,
    caparra: formattaNumeroItaliano(input.condizioni.caparra), // il master ha già "€ " davanti al placeholder
    salPrimi: input.condizioni.salPrimi.map((s) => ({ percentuale: formattaPercentuale(s.percentuale), descrizione: s.descrizione })),
    salSuccessivi: input.condizioni.salSuccessivi.map((s) => ({ percentuale: formattaPercentuale(s.percentuale), descrizione: s.descrizione })),
    validita: input.condizioni.validita,
    'abaco.finestreBattente': input.abaco.finestreBattente,
    'abaco.portefinestreBattente': input.abaco.portefinestreBattente,
    'abaco.fissiVetrate': input.abaco.fissiVetrate,
    'abaco.alzantiScorrevoli': input.abaco.alzantiScorrevoli,
    abacoSerramenti: input.abaco.tutti,
    'abaco.portoncini': input.abaco.portoncini,
  })

  if (chiaviNonRisolte.length > 0) {
    throw new Error(
      `esportaOfferta: tag presenti nel master ma assenti nei dati passati a render() — ` +
        `probabile refuso nella chiave: ${[...new Set(chiaviNonRisolte)].join(', ')}`,
    )
  }

  const buffer = doc.getZip().generate({ type: 'nodebuffer' })
  fs.writeFileSync(input.percorsoOutput, buffer)
}
