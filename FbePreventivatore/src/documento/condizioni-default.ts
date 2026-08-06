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
