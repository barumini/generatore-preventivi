// Fornitore Google Gemini (API diretta di Google AI Studio).
// Documentazione: https://ai.google.dev/gemini-api/docs/image-generation (2026-11-09).
import sharp from "sharp";
import { GEMINI_SIZES, geminiPromptText, geminiRatio } from "./gemini-sizes";
import { httpError, providerFetch, readJson } from "./http";
import { ProviderError, type GenerateInput, type ImageProvider, type ImageQuality } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const LABEL = "Google Gemini";
const MODELS = ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-2.5-flash-image"];

/** Motivi di blocco/arresto che indicano un rifiuto per sicurezza o contenuti. */
const BLOCKED = /SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/;

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

async function mimeType(img: Buffer): Promise<string> {
  const fmt = (await sharp(img).metadata()).format;
  return fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
}

/** Risoluzione d'uscita: solo i modelli Gemini 3 accettano imageSize. */
function imageSize(model: string, quality: ImageQuality): string | undefined {
  if (!/^gemini-3/.test(model)) return undefined;
  return quality === "low" ? "1K" : "2K";
}

type GeminiPart = { text?: string; inlineData?: { data?: unknown }; inline_data?: { data?: unknown } };
type GeminiBody = {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: GeminiPart[] } }[];
  error?: { message?: string; status?: string; details?: { reason?: string }[] };
};

async function generate(input: GenerateInput): Promise<Buffer> {
  const key = apiKey();
  if (!key) throw new ProviderError("config", "Google Gemini non configurato: manca la variabile GEMINI_API_KEY");

  const images = [input.photo, ...(input.mask ? [input.mask] : []), ...input.references];
  const parts = [
    { text: geminiPromptText(input.prompt, Boolean(input.mask), input.references.length) },
    ...(await Promise.all(
      images.map(async (b) => ({ inline_data: { mime_type: await mimeType(b), data: b.toString("base64") } })),
    )),
  ];

  const { width, height } = await sharp(input.photo).metadata();
  const ratio = geminiRatio(width, height);
  const size = imageSize(input.model, input.quality);
  const imageConfig = { ...(ratio ? { aspectRatio: ratio } : {}), ...(size ? { imageSize: size } : {}) };

  const res = await providerFetch(LABEL, `${BASE}/${encodeURIComponent(input.model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
      },
    }),
  });
  const body = (await readJson(res)) as GeminiBody;
  if (!res.ok) {
    const invalidKey = body?.error?.details?.some((d) => d?.reason === "API_KEY_INVALID");
    if (invalidKey || res.status === 401) {
      throw new ProviderError("config", `${LABEL}: chiave API non valida o revocata`);
    }
    throw httpError(LABEL, res.status, body);
  }

  const block = body?.promptFeedback?.blockReason;
  const candidate = body?.candidates?.[0];
  if ((block && BLOCKED.test(block)) || (candidate?.finishReason && BLOCKED.test(candidate.finishReason))) {
    throw new ProviderError(
      "rejected",
      `${LABEL}: richiesta rifiutata dal filtro di sicurezza del fornitore (${block ?? candidate?.finishReason})`,
    );
  }

  const imagePart = candidate?.content?.parts?.find((p) => p.inlineData?.data ?? p.inline_data?.data);
  const data = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
  const buf = typeof data === "string" ? Buffer.from(data, "base64") : null;
  if (!buf || buf.length === 0) throw new ProviderError("upstream", "Il modello non ha restituito un'immagine");
  return buf;
}

export const geminiProvider: ImageProvider = {
  id: "gemini",
  label: LABEL,
  // La maschera viene inviata come indicazione: la casa è protetta dalla ricomposizione dell'app.
  supportsMask: false,
  supportedSizes: GEMINI_SIZES.map(({ width, height }) => ({ width, height })),
  suggestedModels: MODELS,
  isConfigured: () => Boolean(apiKey()),
  generate,
};
