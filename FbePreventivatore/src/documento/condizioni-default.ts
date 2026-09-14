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

/**
 * Default per il nuovo step "Condizioni contrattuali" del wizard, su richiesta esplicita:
 * ogni nuovo preventivo parte con gli stessi consegna/caparra/validità/optional/esclusioni
 * del golden case Crivellaro (`CONDIZIONI_CRIVELLARO` in
 * `costruisci-input-esportazione.test.ts`), non più vuoti — l'operatore li corregge quando
 * differiscono, invece di doverli digitare da zero ogni volta (inclusa la riga optional con
 * `praticaGenioCivile: true`, oggi obbligatoria in `esportaOfferta` per esportare).
 *
 * ATTENZIONE: `validita` è una data fissa ('31.08.2026') presa da un preventivo reale del
 * 2026 — su un nuovo preventivo può risultare già passata o comunque sbagliata per il
 * cliente corrente. Non è ricalcolata dinamicamente: chi compila deve verificarla o
 * aggiornarla, esattamente come per caparra/consegna.
 */
export const CONDIZIONI_DEFAULT: CondizioniForm = {
  consegna: 'da pattuire',
  caparra: 30000,
  validita: '31.08.2026',
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
