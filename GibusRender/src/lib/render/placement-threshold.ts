// Soglia del controllo di posizione. File a sé, senza sharp, perché la usa anche il browser.

/**
 * Scostamento (frazione dell'ingombro del volume) oltre cui una variante è segnalata
 * "Fuori posto". Valore iniziale, da tarare su generazioni reali (vedi README).
 */
export const PLACEMENT_THRESHOLD = 0.25;

export const isMisplaced = (offset: number | null | undefined): boolean =>
  offset != null && offset > PLACEMENT_THRESHOLD;
