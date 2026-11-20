// Coda di generazione della pagina del confronto. Modulo puro, usabile nel browser e nei test.

/** Richieste di variante contemporanee al massimo, per non incappare nei limiti dei fornitori. */
export const MAX_PARALLEL = 4;

/** Una colonna del confronto: varianti richieste al momento della creazione e varianti nel database. */
export type ColumnState = { renderId: string; requested: number; existing: number };

/**
 * Render da lanciare, uno per variante, alternando le colonne così le finiture avanzano insieme.
 * - `"start"`: tutte le varianti richieste di ogni colonna (apertura con ?avvia=1);
 * - `"missing"`: solo quelle che mancano rispetto alle richieste ("Genera le mancanti").
 * Con il fornitore disabilitato non si lancia nulla.
 */
export function planLaunch(
  columns: readonly ColumnState[],
  opts: { providerDisabled: boolean; mode: "start" | "missing" },
): string[] {
  if (opts.providerDisabled) return [];
  const counts = columns.map((c) =>
    Math.max(0, opts.mode === "start" ? c.requested : c.requested - c.existing),
  );
  const out: string[] = [];
  const rounds = Math.max(0, ...counts);
  for (let round = 0; round < rounds; round++) {
    columns.forEach((c, i) => {
      if (round < counts[i]) out.push(c.renderId);
    });
  }
  return out;
}

/**
 * Esegue i compiti con al massimo `limit` in corso alla volta, partendo nell'ordine dato.
 * I risultati sono nell'ordine dei compiti. Un compito che rifiuta non ferma gli altri:
 * si aspettano tutti e poi si rifiuta con il primo errore (nell'ordine dei compiti).
 */
export async function runLimited<T>(tasks: readonly (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  const errors: { index: number; error: unknown }[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch (error) {
        errors.push({ index: i, error });
      }
    }
  }
  const workers = Math.min(Math.max(1, Math.floor(limit)), tasks.length);
  await Promise.all(Array.from({ length: workers }, worker));
  if (errors.length) throw errors.sort((a, b) => a.index - b.index)[0].error;
  return results;
}
