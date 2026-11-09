"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseVariant } from "@/lib/render/actions";
import { ErrorBanner } from "@/components/ErrorBanner";
import { BeforeAfter } from "./BeforeAfter";

/** Dati semplici di una variante, preparati dal server (stale calcolato con isStale). */
export type VariantInfo = {
  id: string;
  status: "PENDING" | "DONE" | "FAILED";
  imageUrl: string | null;
  protected: boolean;
  error: string | null;
  /** PENDING da più di 6 minuti: si mostra come fallita. */
  stale: boolean;
  /** ISO 8601. */
  createdAt: string;
};

const MAX_MORE = 6;
const POLL_MS = 10_000;
const STALE_MESSAGE = "Tempo scaduto, riprova";
const UNPROTECTED = "Casa non protetta: verificare che nulla sia cambiato";

type Card =
  | { kind: "placeholder"; key: string }
  | { kind: "variant"; key: string; v: VariantInfo };

function fromJson(json: unknown): VariantInfo | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.id !== "string" || !["PENDING", "DONE", "FAILED"].includes(o.status as string)) return null;
  return {
    id: o.id,
    status: o.status as VariantInfo["status"],
    imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : null,
    protected: o.protected === true,
    error: typeof o.error === "string" ? o.error : null,
    stale: false,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
  };
}

export function VariantsView({
  renderId,
  photoUrl,
  photoWidth,
  photoHeight,
  initialVariants,
  initialChosenId,
  autoStart,
  defaultMore,
}: {
  renderId: string;
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  initialVariants: VariantInfo[];
  initialChosenId: string | null;
  /** Numero di varianti da lanciare all'apertura (?avvia=1), altrimenti 0. */
  autoStart: number;
  defaultMore: number;
}) {
  const router = useRouter();
  /** Risposte ricevute in questa sessione: hanno la precedenza sui dati del server. */
  const [results, setResults] = useState<VariantInfo[]>([]);
  /** Richieste in corso, una per segnaposto. */
  const [inflight, setInflight] = useState<string[]>([]);
  /** Varianti fallite già ritentate: non si mostrano più in questa sessione. */
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [chosenId, setChosenId] = useState(initialChosenId);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askMore, setAskMore] = useState(false);
  const [moreN, setMoreN] = useState(String(defaultMore));
  const [choosing, startChoose] = useTransition();
  const seq = useRef(0);
  const started = useRef(false);

  function launch(n: number) {
    for (let i = 0; i < n; i++) {
      const key = `tmp-${++seq.current}`;
      setInflight((list) => [...list, key]);
      void (async () => {
        let v: VariantInfo | null = null;
        try {
          const res = await fetch(`/api/renders/${renderId}/variants`, { method: "POST" });
          const json: unknown = await res.json().catch(() => null);
          v = res.ok ? fromJson(json) : null;
          if (!v) {
            const msg = (json as { error?: unknown } | null)?.error;
            v = {
              id: key,
              status: "FAILED",
              imageUrl: null,
              protected: false,
              error: typeof msg === "string" ? msg : `Errore del server (${res.status})`,
              stale: false,
              createdAt: new Date().toISOString(),
            };
          }
        } catch {
          v = {
            id: key,
            status: "FAILED",
            imageUrl: null,
            protected: false,
            error: "Errore di rete, riprova",
            stale: false,
            createdAt: new Date().toISOString(),
          };
        }
        const done = v;
        setResults((list) => [...list.filter((r) => r.id !== done.id), done]);
        setInflight((list) => list.filter((k) => k !== key));
      })();
    }
  }

  // ?avvia=1: lancia le varianti una sola volta e toglie il parametro dall'indirizzo,
  // così ricaricando la pagina non si rilanciano.
  useEffect(() => {
    if (started.current || autoStart <= 0) return;
    started.current = true;
    window.history.replaceState(null, "", `/render/${renderId}`);
    launch(autoStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const local = new Map(results.map((r) => [r.id, r]));
  const busy = inflight.length > 0;
  const cards: Card[] = [];
  for (const v of initialVariants) {
    if (dismissed.has(v.id)) continue;
    const mine = local.get(v.id);
    // Durante i lanci di questa sessione le righe PENDING del server sono già i segnaposto.
    if (!mine && v.status === "PENDING" && !v.stale && busy) continue;
    cards.push({ kind: "variant", key: v.id, v: mine ?? v });
  }
  const serverIds = new Set(initialVariants.map((v) => v.id));
  for (const r of results) {
    if (!serverIds.has(r.id) && !dismissed.has(r.id)) cards.push({ kind: "variant", key: r.id, v: r });
  }
  // Le fallite (o scadute) si nascondono quando dopo di loro esiste una variante riuscita o in corso:
  // restano visibili solo gli errori ancora "attuali".
  const isFailed = (v: VariantInfo) => v.status === "FAILED" || v.stale;
  const lastGood = cards.reduce(
    (max, c) => (c.kind === "variant" && !isFailed(c.v) && c.v.createdAt > max ? c.v.createdAt : max),
    "",
  );
  const visible: Card[] = cards.filter((c) => c.kind !== "variant" || !isFailed(c.v) || c.v.createdAt >= lastGood);
  for (const key of inflight) visible.push({ kind: "placeholder", key });

  // Varianti PENDING arrivate dal server (pagina ricaricata durante la generazione): aggiorna ogni tanto.
  const waitingOnServer = !busy && visible.some((c) => c.kind === "variant" && c.v.status === "PENDING" && !c.v.stale);
  useEffect(() => {
    if (!waitingOnServer) return;
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [waitingOnServer, router]);

  const compare = compareId
    ? visible.find((c) => c.kind === "variant" && c.v.id === compareId && c.v.status === "DONE" && c.v.imageUrl)
    : undefined;

  function retry(id: string) {
    setDismissed((s) => new Set(s).add(id));
    if (compareId === id) setCompareId(null);
    launch(1);
  }

  function choose(id: string) {
    setError(null);
    startChoose(async () => {
      const res = await chooseVariant(renderId, id);
      if (!res.ok) setError(res.error);
      else setChosenId(id);
    });
  }

  function submitMore() {
    const n = Number(moreN);
    if (!Number.isInteger(n) || n < 1 || n > MAX_MORE) {
      setError(`Indica un numero di varianti tra 1 e ${MAX_MORE}`);
      return;
    }
    setError(null);
    setAskMore(false);
    launch(n);
  }

  return (
    <section className="stack">
      <div className="generate-bar">
        <h2 style={{ margin: 0 }}>
          Varianti {busy && <span className="muted small">· {inflight.length} in generazione</span>}
        </h2>
        {askMore ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              submitMore();
            }}
          >
            <label htmlFor="more-n" className="small">Quante?</label>
            <input
              id="more-n"
              type="number"
              min={1}
              max={MAX_MORE}
              step={1}
              value={moreN}
              onChange={(e) => setMoreN(e.target.value)}
              style={{ width: "5rem" }}
              autoFocus
            />
            <button type="submit" className="btn btn-primary">Genera</button>
            <button type="button" className="btn" onClick={() => setAskMore(false)}>Annulla</button>
          </form>
        ) : (
          <button type="button" className="btn" onClick={() => setAskMore(true)}>
            Genera altre varianti
          </button>
        )}
      </div>

      <ErrorBanner message={error} />

      {compare && compare.kind === "variant" && compare.v.imageUrl && (
        <div className="card">
          <div className="generate-bar" style={{ marginBottom: "0.75rem" }}>
            <h2 style={{ margin: 0 }}>Confronto prima/dopo</h2>
            <button type="button" className="btn btn-small" onClick={() => setCompareId(null)}>Chiudi</button>
          </div>
          <BeforeAfter beforeUrl={photoUrl} afterUrl={compare.v.imageUrl} width={photoWidth} height={photoHeight} />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="muted">Nessuna variante ancora. Usa “Genera altre varianti” per avviarne.</p>
      ) : (
        <div className="grid">
          {visible.map((c, i) => {
            const title = `Variante ${i + 1}`;
            if (c.kind === "placeholder" || (c.v.status === "PENDING" && !c.v.stale)) {
              return (
                <div key={c.key} className="card card-link variant-card">
                  <div className="thumb variant-pending">Generazione in corso…</div>
                  <div className="card-body">
                    <h2>{title}</h2>
                    <p className="muted small">Può richiedere qualche minuto.</p>
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
                    <button type="button" className="btn btn-small" onClick={() => retry(v.id)}>Riprova</button>
                  </div>
                </div>
              );
            }
            const chosen = chosenId === v.id;
            return (
              <div key={c.key} className={`card card-link variant-card${chosen ? " variant-chosen" : ""}`}>
                <button
                  type="button"
                  className="thumb thumb-button"
                  onClick={() => setCompareId(v.id)}
                  aria-label={`Confronta ${title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.imageUrl} alt={title} />
                </button>
                <div className="card-body">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h2>{title}</h2>
                    {chosen && <span className="badge badge-ok">Scelta</span>}
                  </div>
                  {!v.protected && <p><span className="badge badge-warn">{UNPROTECTED}</span></p>}
                  <div className="row">
                    <button type="button" className="btn btn-small" onClick={() => setCompareId(v.id)}>Confronta</button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={chosen || choosing}
                      onClick={() => choose(v.id)}
                    >
                      {chosen ? "Scelta" : "Scegli"}
                    </button>
                    <a className="btn btn-small" href={`/api/variants/${v.id}/download`} download>
                      Scarica
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
