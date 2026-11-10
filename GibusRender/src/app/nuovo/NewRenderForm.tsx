"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBanner } from "@/components/ErrorBanner";
import { buildPrompt } from "@/lib/render/prompt";
import { estimateCost } from "@/lib/render/cost";
import { POSITION_REQUIRED, validatePolygon, type Point, type ScaleLine } from "@/lib/render/geometry";
import { COVER_LABELS, MOUNT_LABELS, type CoverType, type FinishKind, type MountType } from "@/lib/catalog/types";
import type { RenderDraft } from "@/lib/render/draft";
import { prepareUpload } from "./upload";
import { PolygonEditor } from "./PolygonEditor";
import { ScaleLineEditor, type ScaleDraft } from "./ScaleLineEditor";

export interface ProductInfo {
  id: string;
  name: string;
  mountType: MountType;
  coverType: CoverType;
  aiDescription: string;
  widthMm: number;
  depthMm: number;
  clearHeightMm: number;
  totalHeightMm: number;
  defaultColorId: string | null;
  defaultFabricId: string | null;
  finishIds: string[];
  referenceCount: number;
  thumbUrl: string | null;
}

export interface FinishInfo {
  id: string;
  kind: FinishKind;
  name: string;
  code: string;
  swatchHex: string | null;
}

export interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  suggestedModels: string[];
  supportsMask: boolean;
}

type Defaults = { providerId: string; model: string; quality: string; variants: number; maxPhotoSide: number };

type Photo =
  | { kind: "upload"; blob: Blob; url: string; width: number; height: number }
  | { kind: "source"; sourceRenderId: string; url: string; width: number; height: number };

type Dims = { widthMm: string; depthMm: string; clearHeightMm: string; totalHeightMm: string };
type Mode = "sagoma" | "scala";

const DIM_FIELDS: { key: keyof Dims; label: string }[] = [
  { key: "widthMm", label: "Larghezza" },
  { key: "depthMm", label: "Profondità" },
  { key: "clearHeightMm", label: "Altezza utile" },
  { key: "totalHeightMm", label: "Altezza totale" },
];

const QUALITY_LABELS: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta" };
const NO_MASK_WARNING = "Senza sagoma la casa non è protetta dalle modifiche dell'IA";

const dimsOf = (p: { widthMm: number; depthMm: number; clearHeightMm: number; totalHeightMm: number }): Dims => ({
  widthMm: String(p.widthMm),
  depthMm: String(p.depthMm),
  clearHeightMm: String(p.clearHeightMm),
  totalHeightMm: String(p.totalHeightMm),
});

/** Numero intero positivo dal campo, altrimenti null. */
function intOrNull(v: string): number | null {
  const t = v.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

function compatible(product: ProductInfo | undefined, finishes: FinishInfo[], kind: FinishKind): FinishInfo[] {
  if (!product) return [];
  return finishes.filter((f) => f.kind === kind && product.finishIds.includes(f.id));
}

/** Finitura valida per il prodotto, altrimenti "" (nessuna). */
function finishOrEmpty(id: string | null, options: FinishInfo[]): string {
  return id && options.some((f) => f.id === id) ? id : "";
}

type PromptState = {
  product: ProductInfo | undefined;
  dims: Dims;
  color: FinishInfo | undefined;
  fabric: FinishInfo | undefined;
  positionText: string;
  polygon: Point[];
  scale: ScaleLine | null;
  photo: { width: number; height: number } | null;
  supportsMask: boolean;
};

/** Prompt automatico (stesso calcolo del server); "" se manca il prodotto. */
function autoPrompt(s: PromptState): string {
  if (!s.product) return "";
  const num = (v: string, fallback: number) => intOrNull(v) ?? fallback;
  const hasPolygon = s.polygon.length > 0 && validatePolygon(s.polygon).ok;
  return buildPrompt({
    product: {
      name: s.product.name,
      mountType: s.product.mountType,
      coverType: s.product.coverType,
      aiDescription: s.product.aiDescription,
    },
    dims: {
      widthMm: num(s.dims.widthMm, s.product.widthMm),
      depthMm: num(s.dims.depthMm, s.product.depthMm),
      clearHeightMm: num(s.dims.clearHeightMm, s.product.clearHeightMm),
      totalHeightMm: num(s.dims.totalHeightMm, s.product.totalHeightMm),
    },
    color: s.color ? { name: s.color.name, code: s.color.code } : undefined,
    fabric: s.fabric ? { name: s.fabric.name, code: s.fabric.code } : undefined,
    positionText: s.positionText.trim(),
    hasMask: hasPolygon && s.supportsMask,
    maskHint: hasPolygon && !s.supportsMask,
    scale:
      s.scale && s.photo
        ? {
            lengthMm: s.scale.lengthMm,
            pixelLength: Math.hypot(
              (s.scale.b.x - s.scale.a.x) * s.photo.width,
              (s.scale.b.y - s.scale.a.y) * s.photo.height,
            ),
            photoWidth: s.photo.width,
          }
        : undefined,
    referenceCount: s.product.referenceCount,
  });
}

function completeScale(line: ScaleDraft, mm: string): ScaleLine | null {
  const lengthMm = intOrNull(mm);
  if (!line.a || !line.b || !lengthMm) return null;
  return { a: line.a, b: line.b, lengthMm };
}

const eur = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function NewRenderForm({
  products,
  finishes,
  providers,
  defaults,
  draft,
}: {
  products: ProductInfo[];
  finishes: FinishInfo[];
  providers: ProviderOption[];
  defaults: Defaults;
  draft: RenderDraft | null;
}) {
  const router = useRouter();

  // --- Stato iniziale (da Impostazioni o dal render di partenza) ---
  const initial = useMemo(() => {
    const product = products.find((p) => p.id === draft?.productId);
    const draftProviderOk = !!draft && providers.some((p) => p.id === draft.providerId);
    const providerId = draftProviderOk
      ? draft.providerId
      : (providers.find((p) => p.id === defaults.providerId) ?? providers[0])?.id ?? defaults.providerId;
    const state = {
      clientRef: draft?.clientRef ?? "",
      productId: product?.id ?? "",
      dims: draft ? dimsOf(draft) : { widthMm: "", depthMm: "", clearHeightMm: "", totalHeightMm: "" },
      colorId: finishOrEmpty(draft?.colorId ?? null, compatible(product, finishes, "COLORE")),
      fabricId: finishOrEmpty(draft?.fabricId ?? null, compatible(product, finishes, "TESSUTO")),
      polygon: draft?.polygon ?? [],
      positionText: draft?.positionText ?? "",
      scale: draft?.scaleLine ? { a: draft.scaleLine.a, b: draft.scaleLine.b } : ({} as ScaleDraft),
      scaleMm: draft?.scaleLine ? String(draft.scaleLine.lengthMm) : "",
      providerId,
      model: draftProviderOk ? draft.model : defaults.model,
      quality: draftProviderOk ? draft.quality : defaults.quality,
      variants: String(draft?.variantsRequested ?? defaults.variants),
      disclaimer: draft?.disclaimer ?? false,
      photo: draft
        ? ({
            kind: "source",
            sourceRenderId: draft.sourceRenderId,
            url: draft.photoUrl,
            width: draft.photoWidth,
            height: draft.photoHeight,
          } as Photo)
        : null,
    };
    // Il prompt del render di partenza resta "modificato a mano" solo se diverso da quello automatico.
    let manualPrompt: string | null = null;
    if (draft && product) {
      const auto = autoPrompt({
        product,
        dims: state.dims,
        color: finishes.find((f) => f.id === state.colorId),
        fabric: finishes.find((f) => f.id === state.fabricId),
        positionText: state.positionText,
        polygon: state.polygon,
        scale: completeScale(state.scale, state.scaleMm),
        photo: state.photo,
        supportsMask: providers.find((p) => p.id === providerId)?.supportsMask ?? true,
      });
      const saved = draft.prompt.replace(/\r\n?/g, "\n");
      if (saved.trim() !== auto.trim()) manualPrompt = saved;
    }
    return { ...state, manualPrompt };
    // Calcolato una sola volta al montaggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [clientRef, setClientRef] = useState(initial.clientRef);
  const [photo, setPhoto] = useState<Photo | null>(initial.photo);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [productId, setProductId] = useState(initial.productId);
  const [dims, setDims] = useState<Dims>(initial.dims);
  const [colorId, setColorId] = useState(initial.colorId);
  const [fabricId, setFabricId] = useState(initial.fabricId);
  const [polygon, setPolygon] = useState<Point[]>(initial.polygon);
  const [positionText, setPositionText] = useState(initial.positionText);
  const [scale, setScale] = useState<ScaleDraft>(initial.scale);
  const [scaleMm, setScaleMm] = useState(initial.scaleMm);
  const [mode, setMode] = useState<Mode>("sagoma");
  const [providerId, setProviderId] = useState(initial.providerId);
  const [model, setModel] = useState(initial.model);
  const [quality, setQuality] = useState(initial.quality);
  const [variants, setVariants] = useState(initial.variants);
  const [disclaimer, setDisclaimer] = useState(initial.disclaimer);
  const [manualPrompt, setManualPrompt] = useState<string | null>(initial.manualPrompt);
  const [editingPrompt, setEditingPrompt] = useState(initial.manualPrompt !== null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Libera l'URL temporaneo della foto quando cambia o si lascia la pagina.
  const uploadUrl = photo?.kind === "upload" ? photo.url : null;
  useEffect(() => {
    if (!uploadUrl) return;
    return () => URL.revokeObjectURL(uploadUrl);
  }, [uploadUrl]);

  const product = products.find((p) => p.id === productId);
  const colors = compatible(product, finishes, "COLORE");
  const fabrics = compatible(product, finishes, "TESSUTO");
  const provider = providers.find((p) => p.id === providerId);
  const scaleLine = completeScale(scale, scaleMm);
  const polygonCheck = polygon.length > 0 ? validatePolygon(polygon) : null;
  const hasPolygon = polygonCheck?.ok === true;
  const variantsN = intOrNull(variants);

  const auto = autoPrompt({
    product,
    dims,
    color: finishes.find((f) => f.id === colorId),
    fabric: finishes.find((f) => f.id === fabricId),
    positionText,
    polygon,
    scale: scaleLine,
    photo,
    supportsMask: provider?.supportsMask ?? true,
  });
  const prompt = manualPrompt ?? auto;
  const cost = variantsN ? estimateCost(providerId, model.trim(), quality, variantsN) : null;

  // --- Azioni ---

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPreparing(true);
    try {
      const blob = await prepareUpload(file, defaults.maxPhotoSide);
      const bmp = await createImageBitmap(blob);
      const next: Photo = { kind: "upload", blob, url: URL.createObjectURL(blob), width: bmp.width, height: bmp.height };
      bmp.close();
      // Sagoma e scala si riferiscono alla foto precedente: con una foto nuova vanno ridisegnate.
      if (photo) {
        setPolygon([]);
        setScale({});
      }
      setPhoto(next);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Foto non leggibile");
    } finally {
      setPreparing(false);
    }
  }

  function chooseProduct(p: ProductInfo) {
    if (p.id === productId) return;
    // Con un render di partenza il cui prodotto non esiste più, si tengono le sue misure.
    if (productId || !draft) setDims(dimsOf(p));
    const cs = compatible(p, finishes, "COLORE");
    const fs = compatible(p, finishes, "TESSUTO");
    setColorId(finishOrEmpty(p.defaultColorId, cs));
    setFabricId(finishOrEmpty(p.defaultFabricId, fs));
    setProductId(p.id);
  }

  function chooseProvider(id: string) {
    setProviderId(id);
    const next = providers.find((p) => p.id === id);
    if (next && !next.suggestedModels.includes(model)) setModel(next.suggestedModels[0] ?? "");
  }

  /** Stessi controlli del server, con gli stessi messaggi. */
  function validate(): string | null {
    if (!clientRef.trim()) return "Indica il riferimento del cliente";
    if (!photo) return "Carica una foto";
    if (!product) return "Scegli un prodotto";
    for (const { key, label } of DIM_FIELDS) {
      const v = intOrNull(dims[key]);
      if (v === null) return `${label}: deve essere un numero intero di millimetri`;
      if (v < 500 || v > 15000) return `${label}: deve essere tra 500 e 15000 mm`;
    }
    if (polygonCheck && !polygonCheck.ok) return `${polygonCheck.error}: completala o cancellala`;
    if (!hasPolygon && !positionText.trim()) return POSITION_REQUIRED;
    const scaleStarted = scale.a || scale.b || scaleMm.trim();
    if (scaleStarted && !scaleLine) {
      return "Scala incompleta: traccia i due punti e indica la lunghezza in mm, oppure cancellala";
    }
    if (scaleLine && scaleLine.lengthMm > 100000) return "Lunghezza di riferimento non valida";
    if (!providerId) return "Nessun fornitore abilitato nelle impostazioni";
    if (!model.trim()) return "Indica il modello";
    if (variantsN === null || variantsN < 1 || variantsN > 6) return "Le varianti devono essere tra 1 e 6";
    if (!prompt.trim()) return "Il testo per l'IA è vuoto: premi Ripristina";
    return null;
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setError(null);
    setSubmitting(true);

    const fd = new FormData();
    fd.set("clientRef", clientRef.trim());
    if (photo!.kind === "upload") fd.set("photo", new File([photo!.blob], "foto.jpg", { type: "image/jpeg" }));
    else fd.set("sourceRenderId", photo!.sourceRenderId);
    fd.set("productId", productId);
    for (const { key } of DIM_FIELDS) fd.set(key, dims[key].trim());
    if (colorId) fd.set("colorId", colorId);
    if (fabricId) fd.set("fabricId", fabricId);
    if (hasPolygon) fd.set("polygon", JSON.stringify(polygon));
    fd.set("positionText", positionText.trim());
    if (scaleLine) fd.set("scaleLine", JSON.stringify(scaleLine));
    fd.set("prompt", prompt);
    fd.set("providerId", providerId);
    fd.set("model", model.trim());
    fd.set("quality", quality);
    fd.set("variantsRequested", String(variantsN));
    fd.set("disclaimer", disclaimer ? "true" : "false");

    try {
      const res = await fetch("/api/renders", { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !body?.id) {
        setError(body?.error ?? `Creazione del render non riuscita (errore ${res.status})`);
        setSubmitting(false);
        return;
      }
      // submitting resta true: si sta lasciando la pagina.
      router.push(`/render/${body.id}?avvia=1`);
    } catch {
      setError("Connessione non riuscita: controlla la rete e riprova");
      setSubmitting(false);
    }
  }

  // --- Interfaccia ---

  const mmValue = intOrNull(scaleMm);

  return (
    <form className="stack new-render" onSubmit={onGenerate} noValidate>
      {/* 1. Foto */}
      <section className="card">
        <h2><span className="step">1</span>Foto del sopralluogo</h2>
        <div className="field">
          <label htmlFor="clientRef">Riferimento cliente</label>
          <input
            id="clientRef"
            type="text"
            value={clientRef}
            onChange={(e) => setClientRef(e.target.value)}
            placeholder="Es. Rossi – via Roma 12"
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="photo">Foto</label>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={(e) => onPhoto(e.target.files?.[0])}
            disabled={preparing || submitting}
          />
          <span className="hint">JPG, PNG o HEIC da smartphone. La foto viene raddrizzata e ridotta a {defaults.maxPhotoSide} px (lato lungo) prima dell&apos;invio: il tetto si cambia dalle Impostazioni.</span>
        </div>
        {preparing && <p className="muted small" role="status">Preparazione della foto…</p>}
        <ErrorBanner message={photoError} />
        {photo && (
          <div className="row photo-info">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Anteprima della foto" className="photo-thumb" />
            <span className="muted small">
              {photo.width} × {photo.height} px
              {photo.kind === "source" && " · foto del render di partenza (caricane una nuova per sostituirla)"}
            </span>
          </div>
        )}
      </section>

      {/* 2. Prodotto */}
      <section className="card">
        <h2><span className="step">2</span>Prodotto</h2>
        {draft && !draft.productId && !productId && (
          <div className="banner-error" role="alert">
            Il prodotto «{draft.productName}» del render di partenza non è più in catalogo: scegline uno.
          </div>
        )}
        {products.length === 0 ? (
          <p className="muted">Nessun prodotto in catalogo: aggiungine uno dal Catalogo.</p>
        ) : (
          <div className="choice-grid" role="radiogroup" aria-label="Prodotto">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === productId}
                className={`choice${p.id === productId ? " choice-selected" : ""}`}
                onClick={() => chooseProduct(p)}
              >
                <span className="choice-thumb">
                  {p.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbUrl} alt="" />
                  ) : (
                    "Nessun riferimento"
                  )}
                </span>
                <span className="choice-name">{p.name}</span>
                <span className="muted small">
                  {MOUNT_LABELS[p.mountType]} · {COVER_LABELS[p.coverType]}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 3. Misure */}
      <section className="card">
        <h2><span className="step">3</span>Misure</h2>
        {!product && !draft ? (
          <p className="muted">Scegli un prodotto: le misure tipo si compilano da sole.</p>
        ) : (
          <>
            <div className="grid-2">
              {DIM_FIELDS.map(({ key, label }) => (
                <div className="field" key={key}>
                  <label htmlFor={key}>{label} (mm)</label>
                  <input
                    id={key}
                    type="number"
                    inputMode="numeric"
                    min={500}
                    max={15000}
                    step={1}
                    value={dims[key]}
                    onChange={(e) => setDims({ ...dims, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <span className="hint muted small">Valgono solo per questo render: il catalogo non cambia.</span>
          </>
        )}
      </section>

      {/* 4. Finiture */}
      <section className="card">
        <h2><span className="step">4</span>Finiture</h2>
        {!product ? (
          <p className="muted">Scegli un prodotto per vedere le finiture disponibili.</p>
        ) : (
          <div className="grid-2">
            <div className="field">
              <label htmlFor="colorId">Colore struttura</label>
              <select id="colorId" value={colorId} onChange={(e) => setColorId(e.target.value)}>
                <option value="">Nessuno (non indicato all&apos;IA)</option>
                {colors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                ))}
              </select>
            </div>
            {fabrics.length > 0 && (
              <div className="field">
                <label htmlFor="fabricId">Tessuto</label>
                <select id="fabricId" value={fabricId} onChange={(e) => setFabricId(e.target.value)}>
                  <option value="">Nessuno (non indicato all&apos;IA)</option>
                  {fabrics.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. Posizione (e linea di scala sulla stessa foto) */}
      <section className="card">
        <h2><span className="step">5</span>Posizione</h2>
        <p className="muted small">
          Disegna sulla foto la sagoma dell&apos;ingombro visibile della pergola (montanti e copertura), descrivila a
          parole, o entrambe le cose.
        </p>
        <p className="muted small">
          Consiglio: lascia un po&apos; di margine attorno alla pergola, soprattutto in alto e dal lato in cui si estende.
          Ciò che il modello disegna fuori dalla sagoma viene tagliato (una pergola a metà), mentre una sagoma troppo
          larga gli lascia più spazio per alterare la casa: se una variante la cambia, l&apos;app la segnala.
        </p>
        {!photo ? (
          <p className="muted">Carica prima la foto.</p>
        ) : (
          <>
            <div className="row" style={{ marginBottom: "0.75rem" }}>
              <div className="segmented" role="group" aria-label="Cosa disegnare sulla foto">
                <button type="button" aria-pressed={mode === "sagoma"} onClick={() => setMode("sagoma")}>Sagoma</button>
                <button type="button" aria-pressed={mode === "scala"} onClick={() => setMode("scala")}>Scala</button>
              </div>
              {mode === "sagoma" ? (
                <button type="button" className="btn btn-small" onClick={() => setPolygon([])} disabled={polygon.length === 0}>
                  Cancella sagoma
                </button>
              ) : (
                <button type="button" className="btn btn-small" onClick={() => setScale({})} disabled={!scale.a}>
                  Cancella linea
                </button>
              )}
            </div>
            <p className="hint muted small">
              {mode === "sagoma"
                ? "Clic sulla foto per aggiungere un punto, trascina un punto per spostarlo, doppio clic su un punto per eliminarlo."
                : "Clic sui due estremi di un elemento di misura nota (es. una porta); trascina gli estremi per correggerli."}
            </p>
            <div className="photo-stage" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Foto del sopralluogo" draggable={false} />
              <PolygonEditor
                points={polygon}
                onChange={setPolygon}
                active={mode === "sagoma"}
                width={photo.width}
                height={photo.height}
              />
              <ScaleLineEditor
                line={scale}
                lengthMm={mmValue}
                onChange={setScale}
                active={mode === "scala"}
                width={photo.width}
                height={photo.height}
              />
            </div>
            {polygonCheck && !polygonCheck.ok && <p className="small muted">{polygonCheck.error}.</p>}
          </>
        )}
        {!hasPolygon && (
          <div className="banner-warn" role="status">
            {NO_MASK_WARNING}. Descrivi la posizione a parole.
          </div>
        )}
        {hasPolygon && provider && !provider.supportsMask && (
          <p className="small muted">
            {provider.label} usa la sagoma solo come indicazione, senza garantirla: la casa viene comunque ripristinata fuori dalla
            sagoma.
          </p>
        )}
        <div className="field">
          <label htmlFor="positionText">Descrizione a parole{hasPolygon ? " (facoltativa)" : ""}</label>
          <textarea
            id="positionText"
            value={positionText}
            onChange={(e) => setPositionText(e.target.value)}
            placeholder="Es. addossata alla parete a destra, sopra il patio, lamelle aperte"
            maxLength={2000}
            style={{ minHeight: "5rem" }}
          />
        </div>
      </section>

      {/* 6. Scala facoltativa */}
      <section className="card">
        <h2><span className="step">6</span>Scala (facoltativa)</h2>
        <p className="muted small">
          Traccia sulla foto, in modalità <strong>Scala</strong>, una linea su un elemento di cui conosci la misura reale
          e indicane la lunghezza. Aiuta l&apos;IA a rispettare le dimensioni.
        </p>
        <div className="row">
          <div className="field" style={{ flex: "1 1 12rem", marginBottom: 0 }}>
            <label htmlFor="scaleMm">Lunghezza reale della linea (mm)</label>
            <input
              id="scaleMm"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={scaleMm}
              onChange={(e) => setScaleMm(e.target.value)}
              placeholder="Es. 2100 per una porta"
            />
          </div>
          <button type="button" className="btn" onClick={() => setMode("scala")} disabled={!photo || mode === "scala"}>
            Traccia sulla foto
          </button>
        </div>
        <p className="small muted" style={{ marginTop: "0.5rem" }}>
          {scaleLine
            ? `Linea di ${scaleLine.lengthMm.toLocaleString("it-IT")} mm impostata.`
            : scale.a && scale.b
              ? "Linea tracciata: indica la lunghezza in mm."
              : scale.a
                ? "Manca il secondo punto della linea."
                : "Nessuna linea di scala."}
        </p>
      </section>

      {/* 7. Fornitore, modello e qualità */}
      <section className="card">
        <h2><span className="step">7</span>Fornitore, modello e qualità</h2>
        <p className="muted small">Valori dalle Impostazioni; le modifiche valgono solo per questo render.</p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="providerId">Fornitore</label>
            <select id="providerId" value={providerId} onChange={(e) => chooseProvider(e.target.value)}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.configured ? "" : " (chiave mancante)"}
                </option>
              ))}
            </select>
            {provider && !provider.configured && (
              <span className="hint">La chiave API di questo fornitore non è impostata: la generazione non partirà.</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="quality">Qualità</label>
            <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
              {Object.entries(QUALITY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="model">Modello</label>
          <select
            aria-label="Modelli suggeriti"
            value={provider?.suggestedModels.includes(model) ? model : ""}
            onChange={(e) => e.target.value && setModel(e.target.value)}
          >
            <option value="">Altro modello (scrivere sotto)</option>
            {provider?.suggestedModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input id="model" type="text" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
      </section>

      {/* 8. Varianti e dicitura */}
      <section className="card">
        <h2><span className="step">8</span>Varianti e dicitura</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="variants">Numero di varianti</label>
            <input
              id="variants"
              type="number"
              inputMode="numeric"
              min={1}
              max={6}
              step={1}
              value={variants}
              onChange={(e) => setVariants(e.target.value)}
            />
          </div>
          <div className="field">
            <span className="label">Dicitura</span>
            <label className="check">
              <input type="checkbox" checked={disclaimer} onChange={(e) => setDisclaimer(e.target.checked)} />
              Aggiungi «Immagine a titolo esemplificativo»
            </label>
          </div>
        </div>
      </section>

      {/* 9. Prompt */}
      <section className="card">
        <h2><span className="step">9</span>Testo per l&apos;IA</h2>
        {!product ? (
          <p className="muted">Scegli un prodotto per vedere il testo che verrà inviato all&apos;IA.</p>
        ) : (
          <>
            <div className="row" style={{ marginBottom: "0.75rem" }}>
              {!editingPrompt && (
                <button type="button" className="btn btn-small" onClick={() => setEditingPrompt(true)}>
                  Modifica testo per l&apos;IA
                </button>
              )}
              {manualPrompt !== null && (
                <>
                  <span className="badge badge-warn">Modificato a mano: non si aggiorna più da solo</span>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      setManualPrompt(null);
                      setEditingPrompt(false);
                    }}
                  >
                    Ripristina
                  </button>
                </>
              )}
            </div>
            {editingPrompt ? (
              <textarea
                aria-label="Testo per l'IA"
                className="prompt-text"
                value={prompt}
                onChange={(e) => setManualPrompt(e.target.value)}
                style={{ minHeight: "18rem" }}
              />
            ) : (
              <pre className="prompt-text" data-testid="prompt-preview">{prompt}</pre>
            )}
          </>
        )}
      </section>

      {/* 10. Stima e Genera */}
      <section className="card generate-bar">
        <div>
          <h2 style={{ marginBottom: "0.25rem" }}><span className="step">10</span>Genera</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {cost
              ? `Costo stimato: circa ${eur(cost.eur)} per ${variantsN} ${variantsN === 1 ? "variante" : "varianti"}`
              : "Stima del costo non disponibile per questo modello"}
          </p>
        </div>
        <div ref={errorRef} style={{ flexBasis: "100%" }}>
          <ErrorBanner message={error} />
        </div>
        <button type="submit" className="btn btn-primary btn-large" disabled={submitting || preparing}>
          {submitting ? "Creazione…" : "Genera"}
        </button>
      </section>
    </form>
  );
}
