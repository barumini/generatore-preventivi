import fs from 'node:fs'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { rilevaPlaceholderSpessoreNonInterpolati, type RisultatoCalcolo, type VoceValorizzata } from '@/domain/calcolo'
import type { AbacoPerCategoria } from '@/ai/abaco'
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
  percorsoOutput?: string
  /**
   * Opt-in esplicito, di default assente/false. Alcune `descrizioneTemplate` del catalogo
   * (`src/domain/voci.ts`) contengono placeholder testuali a doppia graffa (es.
   * `{{spessoreEsterno}}`) che vengono interpolati con i valori raccolti nello step
   * "Configurazione" del wizard (`spessoreEsterno`, `spessoreInterno`, `spessoreCoibente`,
   * `spessoreCappotto` — vedi `interpolaPlaceholder` in `src/domain/calcolo.ts`). Se uno di
   * questi campi resta vuoto il token non viene sostituito, e senza questo flag
   * `esportaOfferta` si blocca per non produrre in silenzio un documento con un residuo di
   * sviluppo dentro una cella che il cliente firma — vedi
   * `rilevaPlaceholderSpessoreNonInterpolati` sotto e `template/PLACEHOLDER.md`. Questo flag
   * serve solo a bypassare il blocco in test o in una preview interna in cui lo spessore è
   * deliberatamente non ancora compilato: non va mai usato per un documento destinato a un
   * cliente reale, il vero rimedio è compilare il campo nel wizard.
   */
  consentiPlaceholderNonRisolti?: boolean
}

function formattaNumeroItaliano(valore: number): string {
  return formattaImportoItaliano(valore).replace(' €', '')
}

function formattaVoceOpzionale(v: VoceOpzionale) {
  return { lettera: v.lettera, descrizione: v.descrizione, importo: formattaImportoItaliano(v.importo) }
}

export function costruisciBufferOfferta(input: InputEsportazione): Buffer {
  const { vociGrezzo, vociPostSconto } = righeVoci(input.risultato)

  const placeholderSpessore = rilevaPlaceholderSpessoreNonInterpolati([...vociGrezzo, ...vociPostSconto])
  if (placeholderSpessore.length > 0 && !input.consentiPlaceholderNonRisolti) {
    throw new Error(
      `esportaOfferta: descrizioni con placeholder di spessore non interpolati: ${[...new Set(placeholderSpessore)].join(', ')}. ` +
        `Compila i campi spessore corrispondenti nello step "Configurazione" del wizard (spessoreEsterno, spessoreInterno, ` +
        `spessoreCoibente, spessoreCappotto — cfr. template/PLACEHOLDER.md) e questo documento non è pronto per un cliente reale finché non lo fai. ` +
        `Passa consentiPlaceholderNonRisolti: true solo per un giro di test/dev in cui lasci deliberatamente uno spessore in bianco.`,
    )
  }

  const contenuto = fs.readFileSync(input.percorsoMaster, 'binary')
  const zip = new PizZip(contenuto)

  const chiaviNonRisolte: string[] = []
  // review Task 17 (Finding 1): il nullGetter di default (o uno che restituisce sempre '')
  // rende un refuso nella chiave passata a render() indistinguibile da un campo vuoto
  // legittimo — la cella si svuota in silenzio in un documento firmato dal cliente. Qui invece
  // ogni tag semplice non risolto (part.module assente: i cicli con dato mancante sono
  // legittimi, cfr. PLACEHOLDER.md "un dato mancante è già equivalente a lista vuota") viene
  // registrato e fa fallire l'export con un errore leggibile.
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

  // review finale piano export-docx-wizard (Finding 3): consegna/validità vuote e caparra a 0
  // sono legittime come stato iniziale del wizard (CONDIZIONI_DEFAULT), ma un export con questi
  // campi ancora così produce un documento firmabile con dati mancanti o — peggio, per la
  // caparra — un "€ 0,00" plausibile ma sbagliato (formattaNumeroItaliano(0) = "0,00", il master
  // ha già "€ " davanti al tag). Stessa filosofia degli altri guardrail di questo file: si
  // rifiuta l'export invece di produrlo silenziosamente incompleto.
  if (input.condizioni.consegna.trim() === '') {
    throw new Error('esportaOfferta: campo "consegna" mancante — obbligatorio per un documento firmabile dal cliente.')
  }
  if (input.condizioni.validita.trim() === '') {
    throw new Error('esportaOfferta: campo "validità offerta" mancante — obbligatorio per un documento firmabile dal cliente.')
  }
  if (input.condizioni.caparra <= 0) {
    throw new Error('esportaOfferta: campo "caparra" mancante o pari a zero — obbligatorio per un documento firmabile dal cliente.')
  }

  // review finale piano export-docx-wizard (Finding 2): senza nessuna riga "optional" marcata
  // come pratica Genio Civile, letteraOptional('pratica-genio-civile') si risolve in stringa
  // vuota e la frase fissa del master ("...quotato al punto {riferimenti.praticaGenioCivile})
  // optional).") resta visibilmente rotta ("...quotato al punto ) optional)."), senza che il
  // nullGetter se ne accorga (il tag SI risolve, solo a una stringa vuota). Stessa filosofia
  // degli altri guardrail: si rifiuta l'export invece di produrre prosa rotta in silenzio.
  const letteraPraticaGenioCivile = letteraOptional('pratica-genio-civile')
  if (letteraPraticaGenioCivile === '') {
    throw new Error(
      'esportaOfferta: nessuna riga "optional" è marcata come pratica Genio Civile — il testo fisso del master ' +
        'richiede questo riferimento ({riferimenti.praticaGenioCivile}, cfr. review Task 17 Finding 2). ' +
        'Aggiungi una riga optional con questo riferimento prima di esportare.',
    )
  }

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
    'riferimenti.praticaGenioCivile': letteraPraticaGenioCivile,
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

  return doc.getZip().generate({ type: 'nodebuffer' })
}

export function esportaOfferta(input: InputEsportazione): void {
  if (!input.percorsoOutput) {
    throw new Error('esportaOfferta: percorsoOutput è obbligatorio per scrivere su disco — usa costruisciBufferOfferta per il flusso HTTP.')
  }
  fs.writeFileSync(input.percorsoOutput, costruisciBufferOfferta(input))
}
