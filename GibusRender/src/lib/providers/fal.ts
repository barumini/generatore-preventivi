// Fornitore fal.ai (coda REST): invio, controllo dello stato, risultato, download.
// Documentazione: https://fal.ai/docs/model-apis/model-endpoints/queue (2026-11-10).
import sharp from "sharp";
import { GEMINI_SIZES, geminiPromptText, geminiRatio } from "./gemini-sizes";
import { PLACEMENT_HINT } from "@/lib/render/prompt";
import { PROVIDER_TIMEOUT_MS, providerFetch, readJson } from "./http";
import { ProviderError, type GenerateInput, type ImageProvider } from "./types";

const QUEUE = "https://queue.fal.run";
const LABEL = "fal.ai";
// Modelli suggeriti: quelli che nel confronto del 2026-11-10 (foto reale, riferimenti reali)
// hanno inserito la pergola lasciando intatta la casa. Gestiti ma NON suggeriti:
// FLUX Kontext (con i disegni fa collage, a immagine singola non inserisce la pergola),
// Nano Banana Lite e GPT Image 1.5 low (hanno rifatto la scena), fal-ai/nano-banana/edit.
const MODELS = [
  "blackforestlabs/flux-3/klein/edit-image", // ~0,009 $, il più economico
  "fal-ai/nano-banana-2/edit", // ~0,08 $
  "fal-ai/nano-banana-pro/edit", // ~0,15 $, il più fedele
];

/** Rapporti d'aspetto accettati da FLUX Kontext (mancano 5:4 e 4:5). */
const KONTEXT_RATIOS = new Set(["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"]);

/** Parametri di attesa; esportati perché i test li azzerano. */
export const falPollConfig = { intervalMs: 1_500, timeoutMs: PROVIDER_TIMEOUT_MS };

/** Numero massimo di immagini in ingresso per richiesta, dove il modello lo limita. */
function maxInputImages(model: string): number {
  if (/flux-pro\/kontext/.test(model)) return 4;
  if (/flux-3\/klein/.test(model)) return 10;
  return Number.POSITIVE_INFINITY;
}

/**
 * FLUX Kontext tratta ogni immagine come contenuto, non come maschera: la
 * disegnerebbe nel risultato. Per lui la posizione resta solo nel testo.
 */
function takesMaskImage(model: string): boolean {
  return !/flux-pro\/kontext/.test(model);
}

/** Formati d'uscita dei modelli gpt-image (non accettano aspect_ratio). */
const GPT_SIZES = [
  { size: "1024x1024", ratio: 1 },
  { size: "1536x1024", ratio: 1.5 },
  { size: "1024x1536", ratio: 2 / 3 },
];

const MODERATION = /content_policy|safety|moderation|flagged|nsfw/i;
const BILLING = /balance|exhausted|locked|billing|credit|quota/i;

function apiKey(): string | undefined {
  return process.env.FAL_KEY?.trim() || undefined;
}

async function dataUrl(img: Buffer): Promise<string> {
  const fmt = (await sharp(img).metadata()).format;
  const mime = fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${img.toString("base64")}`;
}

/** Testo d'errore leggibile da un corpo fal ({ detail: string | [{ type, msg }] }). */
function detailText(body: unknown): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => [(d as { type?: unknown })?.type, (d as { msg?: unknown })?.msg].filter((v) => typeof v === "string").join(": "))
      .filter(Boolean)
      .join("; ");
  }
  const err = (body as { error?: unknown })?.error;
  return typeof err === "string" ? err : "";
}

function falError(status: number, body: unknown): ProviderError {
  const text = detailText(body);
  if (status === 401) return new ProviderError("config", `${LABEL}: chiave API non valida o revocata`);
  if (status === 402 || status === 429 || (status === 403 && BILLING.test(text))) {
    return new ProviderError("quota", `${LABEL}: saldo esaurito o troppe richieste${text ? `: ${text}` : ""}`);
  }
  if (MODERATION.test(text)) {
    return new ProviderError("rejected", `${LABEL}: richiesta rifiutata dal filtro di sicurezza del fornitore: ${text}`);
  }
  return new ProviderError("upstream", `${LABEL}: errore ${status}${text ? `: ${text}` : ""}`);
}

/** Campi specifici del modello oltre a prompt e immagini. */
function modelParams(input: GenerateInput, width: number | undefined, height: number | undefined) {
  const model = input.model;
  if (/gpt-image/.test(model)) {
    const ar = width && height ? width / height : 1.5;
    const size = GPT_SIZES.reduce((a, b) => (Math.abs(Math.log(b.ratio / ar)) < Math.abs(Math.log(a.ratio / ar)) ? b : a)).size;
    return { image_size: size, quality: input.quality };
  }
  // FLUX.3 Klein: la dimensione d'uscita segue la prima immagine (la foto); niente rapporti.
  // La riscrittura del prompt è disattivata: il testo dell'app è già dettagliato.
  if (/flux-3\/klein/.test(model)) return { enable_prompt_expansion: false };
  const ratio = geminiRatio(width, height);
  if (/flux-pro\/kontext/.test(model)) return ratio && KONTEXT_RATIOS.has(ratio) ? { aspect_ratio: ratio } : {};
  // Pro: 1K e 2K costano uguale. Nano Banana 2: 2K costa il 50% in più, quindi solo con qualità alta.
  const resolution = /nano-banana-pro/.test(model)
    ? input.quality === "low"
      ? "1K"
      : "2K"
    : /nano-banana-2/.test(model)
      ? input.quality === "high"
        ? "2K"
        : "1K"
      : undefined;
  return { ...(ratio ? { aspect_ratio: ratio } : {}), ...(resolution ? { resolution } : {}) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generate(input: GenerateInput): Promise<Buffer> {
  const key = apiKey();
  if (!key) throw new ProviderError("config", "fal.ai non configurato: manca la variabile FAL_KEY");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const deadline = Date.now() + falPollConfig.timeoutMs;

  // Foto e maschera hanno la precedenza; i riferimenti si tagliano in ordine di catalogo.
  const mask = input.mask && takesMaskImage(input.model) ? input.mask : undefined;
  const head = [input.photo, ...(mask ? [mask] : [])];
  const images = [...head, ...input.references.slice(0, Math.max(0, maxInputImages(input.model) - head.length))];
  const { width, height } = await sharp(input.photo).metadata();
  const body = {
    prompt: geminiPromptText(
      mask ? input.prompt : input.prompt.replace(PLACEMENT_HINT, "").replace(/\n{3,}/g, "\n\n").trim(),
      Boolean(mask),
      images.length - head.length,
    ),
    image_urls: await Promise.all(images.map(dataUrl)),
    num_images: 1,
    output_format: "png",
    ...modelParams(input, width, height),
  };

  const submitRes = await providerFetch(LABEL, `${QUEUE}/${input.model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const submitted = (await readJson(submitRes)) as { status_url?: string; response_url?: string };
  if (!submitRes.ok) throw falError(submitRes.status, submitted);
  if (!submitted.status_url || !submitted.response_url) {
    throw new ProviderError("upstream", `${LABEL}: risposta della coda non valida`);
  }

  // Controllo dello stato fino a COMPLETED (un errore del modello è un COMPLETED con error).
  for (;;) {
    const statusRes = await providerFetch(LABEL, submitted.status_url, { method: "GET", headers });
    const status = (await readJson(statusRes)) as { status?: string; error?: unknown; error_type?: unknown };
    if (!statusRes.ok) throw falError(statusRes.status, status);
    if (status.status === "COMPLETED") {
      if (status.error || status.error_type) {
        throw falError(422, { detail: `${String(status.error_type ?? "")} ${String(status.error ?? "")}`.trim() });
      }
      break;
    }
    if (Date.now() + falPollConfig.intervalMs >= deadline) {
      throw new ProviderError("timeout", `${LABEL}: tempo scaduto (oltre ${falPollConfig.timeoutMs / 1000} s)`);
    }
    await sleep(falPollConfig.intervalMs);
  }

  const resultRes = await providerFetch(LABEL, submitted.response_url, { method: "GET", headers });
  const result = (await readJson(resultRes)) as { images?: { url?: unknown }[] };
  if (!resultRes.ok) throw falError(resultRes.status, result);
  const url = result?.images?.[0]?.url;
  if (typeof url !== "string") throw new ProviderError("upstream", "Il modello non ha restituito un'immagine");

  // Il file sta su un CDN pubblico: nessuna autorizzazione, la chiave non esce da qui.
  const img = await providerFetch(LABEL, url, { method: "GET" });
  if (!img.ok) throw new ProviderError("upstream", `${LABEL}: download dell'immagine non riuscito (errore ${img.status})`);
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length === 0) throw new ProviderError("upstream", "Il modello non ha restituito un'immagine");
  return buf;
}

export const falProvider: ImageProvider = {
  id: "fal",
  label: LABEL,
  // La maschera viene inviata come indicazione: la casa è protetta dalla ricomposizione dell'app.
  supportsMask: false,
  supportedSizes: GEMINI_SIZES.map(({ width, height }) => ({ width, height })),
  suggestedModels: MODELS,
  isConfigured: () => Boolean(apiKey()),
  generate,
};
