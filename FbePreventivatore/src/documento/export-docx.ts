import fs from 'node:fs'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import type { RisultatoCalcolo } from '@/domain/calcolo'
import { formattaImportoItaliano } from './preview/formattazione'

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
  importo: number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'
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
}

function formattaNumeroItaliano(valore: number): string {
  return formattaImportoItaliano(valore).replace(' €', '')
}

function formattaPercentuale(frazione: number): string {
  return `${(frazione * 100).toFixed(0)}%`
}

function formattaVoceOpzionale(v: VoceOpzionale) {
  return { lettera: v.lettera, descrizione: v.descrizione, importo: formattaImportoItaliano(v.importo) }
}

export function esportaOfferta(input: InputEsportazione): void {
  const contenuto = fs.readFileSync(input.percorsoMaster, 'binary')
  const zip = new PizZip(contenuto)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' })

  const vociGrezzo = input.risultato.vociValorizzate.filter((v) => v.gruppo === 'grezzo')
  const vociPostSconto = input.risultato.vociValorizzate.filter((v) => v.gruppo === 'post_sconto')

  // riferimenti.* non sono mai testo fisso (vincolo 4): si ricalcolano da vociValorizzate/optional ad ogni render
  const numeroVoce = (id: string) => input.risultato.vociValorizzate.find((v) => v.id === id)?.numero ?? ''
  const letteraOptional = (id: string) => input.condizioni.optional.find((v) => v.id === id)?.lettera ?? ''

  const segnoArrotondamento = input.risultato.arrotondamento < 0 ? '+' : '-' // stessa logica di PaginaPrezzi.tsx
  const arrotondamentoTesto = `${segnoArrotondamento} ${formattaImportoItaliano(Math.abs(input.risultato.arrotondamento))}`

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

  const buffer = doc.getZip().generate({ type: 'nodebuffer' })
  fs.writeFileSync(input.percorsoOutput, buffer)
}
