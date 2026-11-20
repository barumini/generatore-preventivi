"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chooseVariant } from "@/lib/render/actions";
import { estimateCost } from "@/lib/render/cost";
import { formatEur } from "@/lib/render/format";
import { MAX_PARALLEL, planLaunch, runLimited } from "@/lib/render/queue";
import {
  localVariantFailure,
  recommendationReason,
  recommendedVariant,
  shouldAutoStart,
  variantFromJson,
  visibleVariants,
  RECOMMENDED,
  STALE_MESSAGE,
  type VariantCard,
  type VariantInfo,
} from "@/lib/render/variant-list";
import { ErrorBanner } from "@/components/ErrorBanner";
import { VariantWarnings } from "@/components/VariantWarnings";

const POLL_MS = 10_000;

export type FinishInfo = { name: string; code: string; swatchHex: string | null };

/** Una colonna del confronto: un render normale con la sua finitura. */
export type ComparisonColumn = {
  renderId: string;
  color: FinishInfo | null;
  fabric: FinishInfo | null;
  /** Varianti richieste alla creazione (lanciate con ?avvia=1). */
  requested: number;
  /** Il render ha un volume 3D: la consigliata è la più vicina al volume. */
  hasVolume: boolean;
  providerId: string;
  model: string;
  quality: string;
  variants: VariantInfo[];
};

/** Richiesta di variante nella coda del browser: segnaposto finché non arriva la risposta. */
type Job = { renderId: string; key: string };

function Finish({ f, none }: { f: FinishInfo | null; none: string }) {
  if (!f) return <span className="muted">{none}</span>;
  return (
    <span>
      {f.swatchHex && <span className="swatch" style={{ background: f.swatchHex }} aria-hidden="true" />} {f.name}{" "}
      <span className="muted small">({f.code})</span>
    </span>
  );
}

/** Immagine a schermo intero; si chiude con un clic o con Esc. */
function Zoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="zoom" onClose={onClose} onClick={() => ref.current?.close()} aria-label={alt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      <button type="button" className="btn btn-small zoom-close">Chiudi</button>
    </dialog>
  );
}

export function ComparisonView({
  comparisonId,
  columns,
  initialChosenId,
  providerDisabled,
}: {
  comparisonId: string;
  columns: ComparisonColumn[];
  /** Variante scelta nel confronto (al massimo una, in uno qualsiasi dei render). */
  initialChosenId: string | null;
  /** Messaggio se il fornitore del confronto è disabilitato nelle impostazioni: niente generazioni. */
  providerDisabled: string | null;
}) {
  const router = useRouter();
  /** Risposte ricevute in questa sessione: hanno la precedenza sui dati del server. */
  const [results, setResults] = useState<{ renderId: string; v: VariantInfo }[]>([]);
  /** Richieste in coda o in corso, una per segnaposto. */
  const [queue, setQueue] = useState<Job[]>([]);
  /** Chiavi delle richieste già partite (le altre aspettano un posto libero). */
  const [running, setRunning] = useState<ReadonlySet<string>>(() => new Set());
  const [chosenId, setChosenId] = useState(initialChosenId);
  const [prevChosenProp, setPrevChosenProp] = useState(initialChosenId);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosing, startChoose] = useTransition();
  const seq = useRef(0);
  const started = useRef(false);
  /** Richieste non ancora concluse, aggiornato subito (lo stato arriva al render successivo). */
  const pending = useRef(0);

  // La scelta può cambiare sul server (altra scheda, refresh): si riallinea quando cambia la prop.
  if (initialChosenId !== prevChosenProp) {
    setPrevChosenProp(initialChosenId);
    setChosenId(initialChosenId);
  }

  async function requestVariant(job: Job): Promise<void> {
    setRunning((s) => new Set(s).add(job.key));
    let v: VariantInfo;
    try {
      const res = await fetch(`/api/renders/${job.renderId}/variants`, { method: "POST" });
      const json: unknown = await res.json().catch(() => null);
      const parsed = res.ok ? variantFromJson(json) : null;
      const msg = (json as { error?: unknown } | null)?.error;
      v = parsed ?? localVariantFailure(job.key, typeof msg === "string" ? msg : `Errore del server (${res.status})`);
    } catch {
      v = localVariantFailure(job.key, "Errore di rete, riprova");
    }
    pending.current--;
    setResults((list) => [...list.filter((r) => r.v.id !== v.id), { renderId: job.renderId, v }]);
    setQueue((list) => list.filter((j) => j.key !== job.key));
    setRunning((s) => {
      const next = new Set(s);
      next.delete(job.key);
      return next;
    });
  }

  /** Mette in coda una richiesta per ogni renderId, al massimo MAX_PARALLEL alla volta. */
  function enqueue(plan: string[]) {
    if (providerDisabled || plan.length === 0) return;
    const jobs = plan.map((renderId) => ({ renderId, key: `tmp-${++seq.current}` }));
    pending.current += jobs.length;
    setQueue((list) => [...list, ...jobs]);
    void runLimited(
      jobs.map((job) => () => requestVariant(job)),
      MAX_PARALLEL,
    );
  }

  const queueOf = (renderId: string) => queue.filter((j) => j.renderId === renderId).map((j) => j.key);
  const cardsOf = (col: ComparisonColumn): VariantCard[] =>
    visibleVariants(
      col.variants,
      results.filter((r) => r.renderId === col.renderId).map((r) => r.v),
      queueOf(col.renderId),
      new Set(),
    );
  /** Varianti presenti nel database (di qualsiasi stato): righe del server e risposte non locali. */
  const existingOf = (col: ComparisonColumn) =>
    new Set([
      ...col.variants.map((v) => v.id),
      ...results.filter((r) => r.renderId === col.renderId && !r.v.local).map((r) => r.v.id),
    ]).size;
  const columnStates = () =>
    columns.map((c) => ({ renderId: c.renderId, requested: c.requested, existing: existingOf(c) }));

  // Al montaggio, con ?avvia=1: lancia una sola volta le varianti richieste di tutti i render
  // e toglie il parametro dall'indirizzo, così ricaricando non si rilanciano.
  useEffect(() => {
    if (!shouldAutoStart(new URLSearchParams(window.location.search), started.current)) return;
    started.current = true;
    window.history.replaceState(null, "", `/confronto/${comparisonId}`);
    enqueue(planLaunch(columnStates(), { providerDisabled: !!providerDisabled, mode: "start" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = queue.length > 0;

  // La coda vive nel browser: lasciando la pagina le richieste non partite si perdono.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const cards = columns.map(cardsOf);

  // Varianti PENDING arrivate dal server (pagina ricaricata durante la generazione): aggiorna ogni tanto.
  const waitingOnServer =
    !busy && cards.some((list) => list.some((c) => c.kind === "variant" && c.v.status === "PENDING" && !c.v.stale));
  useEffect(() => {
    if (!waitingOnServer) return;
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [waitingOnServer, router]);

  const missingPlan = busy ? [] : planLaunch(columnStates(), { providerDisabled: !!providerDisabled, mode: "missing" });
  const missingCost = (() => {
    let eur = 0;
    for (const c of columns) {
      const n = missingPlan.filter((id) => id === c.renderId).length;
      if (n === 0) continue;
      const cost = estimateCost(c.providerId, c.model, c.quality, n);
      if (!cost) return null;
      eur += cost.eur;
    }
    return eur;
  })();

  function choose(renderId: string, variantId: string) {
    setError(null);
    startChoose(async () => {
      const res = await chooseVariant(renderId, variantId);
      if (!res.ok) setError(res.error);
      else setChosenId(variantId);
    });
  }

  const runningCount = queue.filter((j) => running.has(j.key)).length;

  return (
    <section className="stack">
      {providerDisabled && (
        <div className="banner-warn" role="status">
          {providerDisabled}.
        </div>
      )}

      {(busy || missingPlan.length > 0) && (
        <div className="generate-bar">
          {busy ? (
            <p className="muted small" style={{ margin: 0 }}>
              {runningCount} in generazione · {queue.length - runningCount} in coda. Lasciando la pagina, le
              varianti in coda non partono.
            </p>
          ) : (
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (pending.current === 0) enqueue(missingPlan);
                }}
              >
                Genera le mancanti ({missingPlan.length})
              </button>
              <span className="muted small">
                {missingCost !== null
                  ? `Costo stimato: circa ${formatEur(missingCost)}`
                  : "Stima del costo non disponibile per questo modello"}
              </span>
            </div>
          )}
        </div>
      )}

      <ErrorBanner message={error} />

      <div className="comparison" style={{ "--cols": columns.length } as React.CSSProperties}>
        {columns.map((col, i) => {
          const list = cards[i];
          const recommendedId = recommendedVariant(
            list.flatMap((c) => (c.kind === "variant" ? [c.v] : [])),
            { hasVolume: col.hasVolume },
          );
          const hasChosen = list.some((c) => c.kind === "variant" && c.v.id === chosenId);
          return (
            <div key={col.renderId} className={`comparison-col${hasChosen ? " comparison-col-chosen" : ""}`}>
              <div className="comparison-head">
                <Finish f={col.color} none="Nessun colore" />
                <Finish f={col.fabric} none="Nessun tessuto" />
                {hasChosen && <span className="badge badge-ok">Scelta</span>}
              </div>

              {list.length === 0 && <p className="muted small">Nessuna variante.</p>}
              {list.map((c) => {
                const title = `Variante ${c.n}`;
                if (c.kind === "placeholder" || (c.v.status === "PENDING" && !c.v.stale)) {
                  const queued = c.kind === "placeholder" && !running.has(c.key);
                  return (
                    <div key={c.key} className="card card-link variant-card">
                      <div className={`thumb${queued ? "" : " variant-pending"}`}>
                        {queued ? "In coda" : "Generazione in corso…"}
                      </div>
                      <div className="card-body">
                        <h2>{title}</h2>
                      </div>
                    </div>
                  );
                }
                const v = c.v;
                if (v.status !== "DONE" || !v.imageUrl) {
                  return (
                    <div key={c.key} className="card card-link variant-card">
                      <div className="thumb variant-failed">Generazione non riuscita</div>
                      <div className="card-body">
                        <h2>{title}</h2>
                        <p className="small error-text">{v.stale ? STALE_MESSAGE : v.error || "Errore sconosciuto"}</p>
                      </div>
                    </div>
                  );
                }
                const chosen = chosenId === v.id;
                const src = v.imageUrl;
                return (
                  <div key={c.key} className={`card card-link variant-card${chosen ? " variant-chosen" : ""}`}>
                    <button
                      type="button"
                      className="thumb thumb-button"
                      onClick={() => setZoom({ src, alt: title })}
                      aria-label={`Ingrandisci ${title}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={title} />
                    </button>
                    <div className="card-body">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <h2>{title}</h2>
                        <span className="row">
                          {v.id === recommendedId && (
                            <span className="badge badge-ok" title={recommendationReason(col.hasVolume)}>
                              {RECOMMENDED}
                            </span>
                          )}
                          {chosen && <span className="badge badge-ok">Scelta</span>}
                        </span>
                      </div>
                      <VariantWarnings v={v} />
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={chosen || choosing}
                        onClick={() => choose(col.renderId, v.id)}
                      >
                        {chosen ? "Scelta" : "Scegli"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Con la coda non vuota si apre in una nuova scheda, per non interromperla. */}
              <Link
                className="btn btn-small comparison-open"
                href={`/render/${col.renderId}`}
                {...(busy ? { target: "_blank", rel: "noopener" } : {})}
              >
                Apri render →
              </Link>
            </div>
          );
        })}
      </div>

      {zoom && <Zoom src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </section>
  );
}
