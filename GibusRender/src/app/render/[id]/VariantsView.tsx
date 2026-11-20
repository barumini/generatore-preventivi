"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseVariant, deleteVariant } from "@/lib/render/actions";
import type { ProjectedVolume } from "@/lib/render/volume";
import { VolumeOverlay } from "@/components/VolumeOverlay";
import {
  localVariantFailure,
  recommendationReason,
  recommendedVariant,
  shouldAutoStart,
  variantFromJson,
  visibleVariants,
  RECOMMENDED,
  STALE_MESSAGE,
  type VariantInfo,
} from "@/lib/render/variant-list";
import { DeleteButton } from "@/components/DeleteButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { VariantWarnings } from "@/components/VariantWarnings";
import { BeforeAfter } from "./BeforeAfter";

const MAX_MORE = 6;
const POLL_MS = 10_000;

const dismissedKey = (renderId: string) => `gibusrender:nascoste:${renderId}`;

/** Varianti fallite nascoste dall'utente (Riprova o Nascondi), ricordate per render nel browser. */
function loadDismissed(renderId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(dismissedKey(renderId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(renderId: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(dismissedKey(renderId), JSON.stringify([...ids]));
  } catch {
    // Archiviazione non disponibile (navigazione privata, quota): vale solo per questa sessione.
  }
}

export function VariantsView({
  renderId,
  photoUrl,
  photoWidth,
  photoHeight,
  initialVariants,
  initialChosenId,
  requested,
  defaultMore,
  providerDisabled,
  volume,
  hasVolume,
}: {
  /** Volume 3D del render proiettato sulla foto; null se il render non ne ha. */
  volume: ProjectedVolume | null;
  /** Il render ha un volume 3D: la variante consigliata è quella più vicina al volume. */
  hasVolume: boolean;
  renderId: string;
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  initialVariants: VariantInfo[];
  initialChosenId: string | null;
  /** Varianti da lanciare all'apertura con ?avvia=1. */
  requested: number;
  defaultMore: number;
  /** Messaggio se il fornitore del render è disabilitato nelle impostazioni: niente nuove generazioni. */
  providerDisabled: string | null;
}) {
  const router = useRouter();
  /** Risposte ricevute in questa sessione: hanno la precedenza sui dati del server. */
  const [results, setResults] = useState<VariantInfo[]>([]);
  /** Richieste in corso, una per segnaposto. */
  const [inflight, setInflight] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [chosenId, setChosenId] = useState(initialChosenId);
  const [prevChosenProp, setPrevChosenProp] = useState(initialChosenId);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askMore, setAskMore] = useState(false);
  const [moreN, setMoreN] = useState(String(defaultMore));
  const [choosing, startChoose] = useTransition();
  const seq = useRef(0);
  const started = useRef(false);

  // La scelta può cambiare sul server (altra scheda, refresh): si riallinea quando cambia la prop.
  if (initialChosenId !== prevChosenProp) {
    setPrevChosenProp(initialChosenId);
    setChosenId(initialChosenId);
  }

  function launch(n: number) {
    if (providerDisabled) return;
    for (let i = 0; i < n; i++) {
      const key = `tmp-${++seq.current}`;
      setInflight((list) => [...list, key]);
      void (async () => {
        let v: VariantInfo;
        try {
          const res = await fetch(`/api/renders/${renderId}/variants`, { method: "POST" });
          const json: unknown = await res.json().catch(() => null);
          const parsed = res.ok ? variantFromJson(json) : null;
          const msg = (json as { error?: unknown } | null)?.error;
          v = parsed ?? localVariantFailure(key, typeof msg === "string" ? msg : `Errore del server (${res.status})`);
        } catch {
          v = localVariantFailure(key, "Errore di rete, riprova");
        }
        setResults((list) => [...list.filter((r) => r.id !== v.id), v]);
        setInflight((list) => list.filter((k) => k !== key));
      })();
    }
  }

  // Al montaggio: legge le varianti nascoste e, con ?avvia=1, lancia una sola volta
  // togliendo il parametro dall'indirizzo, così ricaricando non si rilanciano.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage esiste solo nel browser
    setDismissed(loadDismissed(renderId));
    if (!shouldAutoStart(new URLSearchParams(window.location.search), started.current)) return;
    started.current = true;
    window.history.replaceState(null, "", `/render/${renderId}`);
    launch(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = inflight.length > 0;
  const visible = visibleVariants(initialVariants, results, inflight, dismissed);
  const recommendedId = recommendedVariant(
    visible.flatMap((c) => (c.kind === "variant" ? [c.v] : [])),
    { hasVolume },
  );

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

  function dismiss(id: string) {
    setDismissed((s) => {
      const next = new Set(s).add(id);
      saveDismissed(renderId, next);
      return next;
    });
    if (compareId === id) setCompareId(null);
  }

  function retry(id: string) {
    dismiss(id);
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
        {askMore && !providerDisabled ? (
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
          <button type="button" className="btn" onClick={() => setAskMore(true)} disabled={!!providerDisabled}>
            Genera altre varianti
          </button>
        )}
      </div>

      {volume && (
        <label className="row small" style={{ gap: "0.4rem" }}>
          <input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} />
          Mostra volume: sovrappone alle varianti il volume disegnato, per controllare allineamento e misure
        </label>
      )}

      {providerDisabled && (
        <div className="banner-warn" role="status">
          {providerDisabled}.
        </div>
      )}

      <ErrorBanner message={error} />

      {compare && compare.kind === "variant" && compare.v.imageUrl && (
        <div className="card">
          <div className="generate-bar" style={{ marginBottom: "0.75rem" }}>
            <h2 style={{ margin: 0 }}>Confronto prima/dopo</h2>
            <button type="button" className="btn btn-small" onClick={() => setCompareId(null)}>Chiudi</button>
          </div>
          <BeforeAfter
            beforeUrl={photoUrl}
            afterUrl={compare.v.imageUrl}
            width={photoWidth}
            height={photoHeight}
            overlay={volume && showVolume ? <VolumeOverlay pv={volume} width={photoWidth} height={photoHeight} /> : null}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="muted">Nessuna variante ancora. Usa “Genera altre varianti” per avviarne.</p>
      ) : (
        <div className="grid">
          {visible.map((c) => {
            const title = `Variante ${c.n}`;
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
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => retry(v.id)}
                        disabled={!!providerDisabled}
                      >
                        Riprova
                      </button>
                      <button type="button" className="link-button small" onClick={() => dismiss(v.id)}>
                        Nascondi
                      </button>
                    </div>
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
                  {volume && showVolume && (
                    <VolumeOverlay pv={volume} width={photoWidth} height={photoHeight} fit="contain" />
                  )}
                </button>
                <div className="card-body">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h2>{title}</h2>
                    <span className="row">
                      {v.id === recommendedId && (
                        <span className="badge badge-ok" title={recommendationReason(hasVolume)}>
                          {RECOMMENDED}
                        </span>
                      )}
                      {chosen && <span className="badge badge-ok">Scelta</span>}
                    </span>
                  </div>
                  <VariantWarnings v={v} />
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
                    <DeleteButton
                      small
                      confirmText="Eliminare questa variante? L'immagine verrà cancellata e non si potrà recuperare."
                      action={async () => {
                        const res = await deleteVariant(v.id);
                        if (res.ok) dismiss(v.id); // sparisce subito, anche se era in stato locale
                        return res;
                      }}
                    />
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
