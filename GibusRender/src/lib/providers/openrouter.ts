import sharp from "sharp";
import { httpError, providerFetch, readJson } from "./http";
import { GEMINI_SIZES as SIZES, geminiPromptText, geminiRatio } from "./gemini-sizes";
import { ProviderError, type GenerateInput, type ImageProvider } from "./types";

const URL_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const LABEL = "OpenRouter";
const DEFAULT_MODELS = ["google/gemini-2.5-flash-image"];


/** URL dell'app per l'header HTTP-Referer (attribuzione su OpenRouter). */
function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

function apiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/** Modelli suggeriti da OPENROUTER_MODELS (separati da virgola), con un predefinito. */
export function openrouterSuggestedModels(): string[] {
  const list = (process.env.OPENROUTER_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

async function dataUrl(img: Buffer): Promise<string> {
  const fmt = (await sharp(img).metadata()).format;
  const mime = fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${img.toString("base64")}`;
}

function decodeDataUrl(url: string): Buffer | null {
  const m = /^data:image\/[\w.+-]+;base64,([\s\S]+)$/.exec(url);
  return m ? Buffer.from(m[1], "base64") : null;
}

function promptText(input: GenerateInput): string {
  return geminiPromptText(input.prompt, Boolean(input.mask), input.references.length);
}

async function generate(input: GenerateInput): Promise<Buffer> {
  const key = apiKey();
  if (!key) throw new ProviderError("config", "OpenRouter non configurato: manca la variabile OPENROUTER_API_KEY");

  const images = [input.photo, ...(input.mask ? [input.mask] : []), ...input.references];
  const content = [
    { type: "text", text: promptText(input) },
    ...(await Promise.all(images.map(async (b) => ({ type: "image_url", image_url: { url: await dataUrl(b) } })))),
  ];

  const { width, height } = await sharp(input.photo).metadata();
  const ratio = geminiRatio(width, height);

  const res = await providerFetch(LABEL, URL_CHAT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": appUrl(),
      "X-Title": "GibusRender",
    },
    body: JSON.stringify({
      model: input.model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
      ...(ratio ? { image_config: { aspect_ratio: ratio } } : {}),
    }),
  });
  const body = await readJson(res);
  if (!res.ok) throw httpError(LABEL, res.status, body);
  // OpenRouter può rispondere 200 con un oggetto error.
  if ((body as { error?: unknown })?.error) throw httpError(LABEL, 502, body);

  const url = (body as { choices?: { message?: { images?: { image_url?: { url?: unknown } }[] } }[] })?.choices?.[0]
    ?.message?.images?.[0]?.image_url?.url;
  const buf = typeof url === "string" ? decodeDataUrl(url) : null;
  if (!buf || buf.length === 0) throw new ProviderError("upstream", "Il modello non ha restituito un'immagine");
  return buf;
}

export const openrouterProvider: ImageProvider = {
  id: "openrouter",
  label: "OpenRouter",
  // La maschera viene inviata solo come indicazione: la casa non è protetta dal modello.
  supportsMask: false,
  supportedSizes: SIZES.map(({ width, height }) => ({ width, height })),
  get suggestedModels() {
    return openrouterSuggestedModels();
  },
  isConfigured: () => Boolean(apiKey()),
  generate,
};
