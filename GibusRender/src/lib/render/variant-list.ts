// Logica pura della pagina render e dell'archivio: nessun import da server o React,
// usabile sia nei componenti client sia nei test.

/** Dati semplici di una variante (stale calcolato sul server con isStale). */
export type VariantInfo = {
  id: string;
  status: "PENDING" | "DONE" | "FAILED";
  imageUrl: string | null;
  protected: boolean;
  error: string | null;
  /** Differenza media fuori dalla sagoma (0–255); null/assente senza sagoma o per le varianti vecchie. */
  driftScore?: number | null;
  /** Pergola probabilmente tagliata dal bordo dell'area ricomposta. */
  truncated?: boolean;
  /** PENDING da più di 6 minuti: si mostra come fallita. */
  stale: boolean;
  /** ISO 8601, orologio del server. */
  createdAt: string;
  /** Errore nato nel browser (rete, risposta non valida): non esiste una riga nel database. */
  local?: boolean;
};

export type VariantCard =
  | { kind: "variant"; key: string; n: number; v: VariantInfo }
  | { kind: "placeholder"; key: string; n: number };

export const isFailedVariant = (v: VariantInfo): boolean => v.status === "FAILED" || v.stale;

function byCreatedThenId(a: VariantInfo, b: VariantInfo): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Elenco delle schede da mostrare.
 * - Unisce righe del server e risposte locali per id (la risposta locale vince).
 * - Ordine stabile per createdAt e poi id; gli errori solo locali (senza riga nel
 *   database, con orologio del browser) vanno dopo, nell'ordine di arrivo; i segnaposto in fondo.
 * - Con richieste in corso, le righe PENDING non scadute del server sono già
 *   rappresentate dai segnaposto e non si ripetono.
 * - `n` è la posizione nell'ordine stabile, calcolata prima di togliere le nascoste.
 */
export function visibleVariants(
  serverRows: readonly VariantInfo[],
  localResults: readonly VariantInfo[],
  inflight: readonly string[],
  dismissed: ReadonlySet<string>,
): VariantCard[] {
  const merged = new Map<string, VariantInfo>();
  for (const r of serverRows) merged.set(r.id, r);
  const localOnly: VariantInfo[] = [];
  for (const r of localResults) {
    if (r.local && !merged.has(r.id)) localOnly.push(r);
    else merged.set(r.id, r);
  }
  const busy = inflight.length > 0;
  const real = [...merged.values()]
    .filter((v) => !(busy && v.status === "PENDING" && !v.stale))
    .sort(byCreatedThenId);

  const cards: VariantCard[] = [...real, ...localOnly].map((v, i) => ({ kind: "variant", key: v.id, n: i + 1, v }));
  const visible = cards.filter((c) => !dismissed.has(c.key));
  inflight.forEach((key, i) => visible.push({ kind: "placeholder", key, n: cards.length + i + 1 }));
  return visible;
}

/** Miniatura dell'archivio: variante scelta se DONE, altrimenti la prima DONE, altrimenti la foto. */
export function archiveThumbnail(render: {
  photoUrl: string;
  chosenVariantId: string | null;
  variants: readonly { id: string; status: string; imageUrl: string | null; createdAt: Date }[];
}): string {
  const done = render.variants
    .filter((v) => v.status === "DONE" && v.imageUrl)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
  const chosen = done.find((v) => v.id === render.chosenVariantId);
  return (chosen ?? done[0])?.imageUrl ?? render.photoUrl;
}

/** true se l'indirizzo chiede l'avvio (?avvia=1) e non è già stato fatto. */
export function shouldAutoStart(searchParams: { get(name: string): string | null }, alreadyStarted: boolean): boolean {
  return !alreadyStarted && searchParams.get("avvia") === "1";
}

/** Pagina dell'archivio: intero tra 1 e `pages`; valori non numerici o non finiti → 1. */
export function clampPage(raw: string | string[] | undefined, pages: number): number {
  const n = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, pages), Math.max(1, Math.floor(n)));
}
