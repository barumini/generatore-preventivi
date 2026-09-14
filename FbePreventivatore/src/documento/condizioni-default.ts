// src/documento/condizioni-default.ts
//
// Valori iniziali della pagina 6 (condizioni di pagamento).
//
// Il wizard non raccoglie ancora le condizioni: è un follow-up esplicito. Fino ad
// allora la preview parte da qui. Il modulo è TypeScript puro senza React di
// proposito, così può servire anche l'export docx (`export-docx.ts`, lato server)
// e il futuro step del form senza tirarsi dietro un componente.

export interface SalDefault {
  percentuale: number
  milestone: string
}

/**
 * La scaletta SAL standard FBE, così come osservata nei documenti reali
 * (spec §4.3, cfr. `template/PLACEHOLDER.md` → "Le percentuali di default non
 * sono più nel master": le 7 righe fisse sono state ridotte a 2 righe-modello,
 * quindi chi renderizza deve fornire i dati).
 *
 * Le percentuali sommano a 100. L'ordine è quello del documento e non è
 * indifferente: nel master una riga fissa con la clausola di fidejussione cade
 * fra il 3° e il 4° SAL, per cui l'export docx passa `slice(0, 3)` a `salPrimi`
 * e `slice(3)` a `salSuccessivi`.
 *
 * NOTA sul nome del campo: `SalRata` in `export-docx.ts` chiama `descrizione`
 * quello che qui (e in `PaginaCondizioni`) si chiama `milestone`. Chi cabla
 * l'export deve rimappare, non c'è una conversione implicita.
 */
export const SAL_DEFAULT: readonly SalDefault[] = [
  { percentuale: 0.2, milestone: 'Acconto al contratto' },
  { percentuale: 0.1, milestone: 'Informativa di cantiere' },
  { percentuale: 0.4, milestone: 'Inizio montaggio' },
  { percentuale: 0.1, milestone: 'Al tetto primo tavolato (escluso tegole)' },
  { percentuale: 0.1, milestone: 'Cappotto esterno grezzo (escluso intonachino)' },
  { percentuale: 0.05, milestone: 'Inizio posa Cartongesso' },
  { percentuale: 0.05, milestone: 'Fine lavori' },
]

/**
 * Segnaposto per i campi che il wizard non raccoglie ancora (caparra, consegna,
 * validità). Deve restare visibilmente incompleto: un valore finto ma plausibile
 * — una data di validità inventata, un importo di caparra tondo — verrebbe
 * scambiato per un dato reale e finirebbe in un'offerta al cliente.
 */
export const CONDIZIONE_DA_DEFINIRE = '— da definire'

export interface SalRataForm {
  percentuale: number
  descrizione: string
}

export interface VoceEsclusioneForm {
  descrizione: string
  importo: number | string
}

export interface VoceOptionalForm extends VoceEsclusioneForm {
  // Al più una riga alla volta nell'intera lista `optional` può averlo a true —
  // è l'unico id con un rimando nel testo fisso del master ({riferimenti.praticaGenioCivile}).
  // Il vincolo di esclusività si applica in StepCondizioniContrattuali, non qui.
  praticaGenioCivile?: boolean
}

export interface CondizioniForm {
  consegna: string
  caparra: number
  validita: string
  sal: SalRataForm[]
  optional: VoceOptionalForm[]
  esclusioni: VoceEsclusioneForm[]
}

/** Durata di validità offerta di default, in giorni da oggi (usata da `validitaDefault`). */
const GIORNI_VALIDITA_DEFAULT = 30

/**
 * `gg.mm.aaaa` — stesso stile puntato del campo "Validità offerta" (es. '31.08.2026'), non
 * lo stile "Luogo, 6 agosto 2026" di `formattaDataItaliana` (usato solo in copertina).
 * Legge/scrive sempre in fuso locale (nessun parsing di stringa ISO qui, solo aritmetica su
 * un `Date` già istanziato): non ricorre il bug di fuso descritto in
 * `formatta-data-italiana.ts`, che riguarda `new Date(isoDateOnly)`.
 */
function formattaDataPuntata(data: Date): string {
  const giorno = String(data.getDate()).padStart(2, '0')
  const mese = String(data.getMonth() + 1).padStart(2, '0')
  return `${giorno}.${mese}.${data.getFullYear()}`
}

/**
 * Oggi + `GIORNI_VALIDITA_DEFAULT`, calcolato al momento della chiamata (non al caricamento
 * del modulo): `creaCondizioniDefault` è quindi una funzione, non una costante, altrimenti
 * lato server (import una tantum nel processo Node di `costruisci-input-esportazione.ts`)
 * la data resterebbe quella del boot del server, non quella di "oggi" per ogni richiesta.
 */
function validitaDefault(): string {
  const data = new Date()
  data.setDate(data.getDate() + GIORNI_VALIDITA_DEFAULT)
  return formattaDataPuntata(data)
}

/**
 * Default per lo step "Condizioni contrattuali" del wizard, su richiesta esplicita: ogni
 * nuovo preventivo parte con gli stessi consegna/caparra/optional/esclusioni del golden case
 * Crivellaro (`CONDIZIONI_CRIVELLARO` in `costruisci-input-esportazione.test.ts`), non più
 * vuoti — l'operatore li corregge quando differiscono, invece di doverli digitare da zero
 * ogni volta (inclusa la riga optional con `praticaGenioCivile: true`, oggi obbligatoria in
 * `esportaOfferta` per esportare). `validita` è invece calcolata (oggi + 30 giorni), non presa
 * dal golden case: una data fissa presa da un preventivo reale del 2026 sarebbe rapidamente
 * passata per ogni preventivo successivo — resta comunque un valore PROPOSTO, non vincolante:
 * l'operatore lo corregge se la trattativa richiede una validità diversa.
 *
 * Funzione, non un oggetto costante: ogni chiamata rilegge "oggi" e restituisce array nuovi
 * (sal/optional/esclusioni), così due chiamate non condividono mai lo stesso riferimento
 * mutabile.
 */
export function creaCondizioniDefault(): CondizioniForm {
  return {
    consegna: 'da pattuire',
    caparra: 30000,
    validita: validitaDefault(),
    sal: SAL_DEFAULT.map((s) => ({ percentuale: s.percentuale, descrizione: s.milestone })),
    optional: [
      {
        descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici',
        importo: 5000,
        praticaGenioCivile: true,
      },
    ],
    esclusioni: [{ descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' }],
  }
}
