import sharp from "sharp";
import { httpError, providerFetch, readJson } from "./http";
import { ProviderError, type GenerateInput, type ImageProvider } from "./types";

const URL_EDITS = "https://api.openai.com/v1/images/edits";
const LABEL = "OpenAI";

function apiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

/**
 * Maschera dell'app (bianco = da modificare) → formato OpenAI: PNG RGBA della
 * stessa dimensione della foto, alfa 0 dove modificare e 255 altrove.
 */
async function toOpenAIMask(mask: Buffer, width: number, height: number): Promise<Buffer> {
  const { data } = await sharp(mask)
    .resize(width, height, { fit: "fill" })
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const edit = data[i] >= 128;
    const o = i * 4;
    rgba[o] = rgba[o + 1] = rgba[o + 2] = edit ? 255 : 0;
    rgba[o + 3] = edit ? 0 : 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function blob(buf: Buffer, type: string): Blob {
  return new Blob([new Uint8Array(buf)], { type });
}

async function asPng(img: Buffer): Promise<Buffer> {
  return (await sharp(img).metadata()).format === "png" ? img : sharp(img).png().toBuffer();
}

async function generate(input: GenerateInput): Promise<Buffer> {
  const key = apiKey();
  if (!key) throw new ProviderError("config", "OpenAI non configurato: manca la variabile OPENAI_API_KEY");

  // La maschera deve avere formato e dimensioni della prima immagine: foto in PNG.
  const photo = await asPng(input.photo);
  const { width, height } = await sharp(photo).metadata();
  if (!width || !height) throw new ProviderError("upstream", "Foto non leggibile");

  const form = new FormData();
  form.append("model", input.model);
  form.append("prompt", input.prompt);
  form.append("quality", input.quality);
  form.append("n", "1");
  form.append("size", `${width}x${height}`);
  form.append("image[]", blob(photo, "image/png"), "foto.png");
  for (const [i, ref] of input.references.entries()) {
    const fmt = (await sharp(ref).metadata()).format;
    const type = fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
    form.append("image[]", blob(ref, type), `riferimento-${i + 1}.${fmt === "jpeg" ? "jpg" : fmt ?? "png"}`);
  }
  if (input.mask) {
    form.append("mask", blob(await toOpenAIMask(input.mask, width, height), "image/png"), "maschera.png");
  }

  const res = await providerFetch(LABEL, URL_EDITS, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const body = await readJson(res);
  if (!res.ok) throw httpError(LABEL, res.status, body);

  const b64 = (body as { data?: { b64_json?: unknown }[] })?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) {
    throw new ProviderError("upstream", "Il modello non ha restituito un'immagine");
  }
  return Buffer.from(b64, "base64");
}

export const openaiProvider: ImageProvider = {
  id: "openai",
  label: "OpenAI",
  supportsMask: true,
  // Dimensioni standard comuni a tutti i modelli GPT Image.
  supportedSizes: [
    { width: 1024, height: 1024 },
    { width: 1536, height: 1024 },
    { width: 1024, height: 1536 },
  ],
  // gpt-image-1 è stato spento da OpenAI il 23/10/2026.
  suggestedModels: ["gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.5-flare"],
  isConfigured: () => Boolean(apiKey()),
  generate,
};
