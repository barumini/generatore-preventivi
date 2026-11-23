// Combinazioni di finiture per il confronto: logica pura, nessun import da server o React,
// usabile sia nel form del browser sia nella route del server.
import { z } from "zod";

/** Una finitura del confronto: colore e/o tessuto (null = non scelto). */
export type FinishCombo = { colorId: string | null; fabricId: string | null };

export const MIN_COMBOS = 2;
export const MAX_COMBOS = 6;

/** Prodotto cartesiano colori × tessuti; senza scelte resta una sola combinazione vuota. */
export function finishCombos(colorIds: readonly string[], fabricIds: readonly string[]): FinishCombo[] {
  const colors: (string | null)[] = colorIds.length > 0 ? [...colorIds] : [null];
  const fabrics: (string | null)[] = fabricIds.length > 0 ? [...fabricIds] : [null];
  return colors.flatMap((colorId) => fabrics.map((fabricId) => ({ colorId, fabricId })));
}

/** Messaggio di errore per l'elenco scelto, o null se va bene. I duplicati prevalgono sul conteggio. */
export function checkCombos(combos: readonly FinishCombo[]): string | null {
  const keys = new Set(combos.map((c) => JSON.stringify([c.colorId, c.fabricId])));
  if (keys.size < combos.length) return "Finiture ripetute nel confronto";
  if (combos.length < MIN_COMBOS) {
    return "Scegli almeno due finiture da confrontare, oppure spegni «Confronta più finiture»";
  }
  if (combos.length > MAX_COMBOS) return `Al massimo ${MAX_COMBOS} finiture per confronto: ne hai scelte ${combos.length}`;
  return null;
}

const comboSchema = z.object({
  colorId: z.string().nullable(),
  fabricId: z.string().nullable(),
});

/** Valida l'elenco ricevuto dal browser o dal server; lancia se la forma non è valida. */
export function parseCombos(raw: unknown): FinishCombo[] {
  const parsed = z.array(comboSchema).safeParse(raw);
  if (!parsed.success) throw new Error("Finiture del confronto non valide");
  return parsed.data;
}
