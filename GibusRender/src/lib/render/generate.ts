// Orchestrazione: creazione del render e generazione di una variante.
// Solo lato server (Prisma, sharp, fornitori).
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Render, Variant } from "@/generated/prisma/client";
import { getFile, putFile } from "@/lib/storage";
import { getProvider, PROVIDER_IDS } from "@/lib/providers/registry";
import { ProviderError, type ImageProvider, type ImageQuality } from "@/lib/providers/types";
import { POSITION_REQUIRED, validatePolygon, type Point } from "./geometry";
import { featheredAlpha, polygonToMask } from "./mask";
import {
  addDisclaimer,
  composite,
  fromProviderSize,
  normalizePhoto,
  pickProviderSize,
  toJpeg,
  toProviderSize,
} from "./image";
import { buildPrompt } from "./prompt";
import type { CoverType, MountType } from "@/lib/catalog/types";

/** Errore di validazione dell'input, con messaggio italiano mostrabile all'utente. */
export class RenderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderInputError";
  }
}

export { POSITION_REQUIRED };

/** Errore 404: il render di partenza (sourceRenderId) non esiste. */
export class SourceRenderNotFoundError extends RenderInputError {}

export const SOURCE_NOT_FOUND = "Render di partenza non trovato";
export const PHOTO_REQUIRED = "Carica una foto";
export const PHOTO_AND_SOURCE =
  "Carica una nuova foto oppure riusa quella del render di partenza, non entrambe";

const point = z.object({
  x: z.number({ error: "Coordinate della sagoma non valide" }).finite(),
  y: z.number({ error: "Coordinate della sagoma non valide" }).finite(),
});

const mm = (label: string) =>
  z
    .number({ error: `${label}: valore non valido` })
    .int({ error: `${label}: deve essere un numero intero di millimetri` })
    .min(500, { error: `${label}: deve essere tra 500 e 15000 mm` })
    .max(15000, { error: `${label}: deve essere tra 500 e 15000 mm` });

/** Il multipart del browser trasforma gli a capo in CRLF: si torna a LF. */
const lf = (v: string) => v.replace(/\r\n?/g, "\n");

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined);

const scaleLineSchema = z.object(
  {
    a: point,
    b: point,
    lengthMm: z
      .number({ error: "Lunghezza di riferimento non valida" })
      .positive({ error: "La lunghezza di riferimento deve essere positiva" })
      .max(100000, { error: "Lunghezza di riferimento non valida" }),
  },
  { error: "Linea di riferimento non valida" },
);

export const CreateRenderInput = z
  .object({
    clientRef: z
      .string({ error: "Indica il riferimento del cliente" })
      .trim()
      .min(1, { error: "Indica il riferimento del cliente" })
      .max(200, { error: "Riferimento del cliente troppo lungo" }),
    photo: z.union([z.instanceof(Buffer), z.instanceof(File)], { error: PHOTO_REQUIRED }).optional(),
    /** In alternativa a `photo`: riusa la foto normalizzata di questo render. */
    sourceRenderId: optionalId,
    productId: z.string({ error: "Scegli un prodotto" }).trim().min(1, { error: "Scegli un prodotto" }),
    widthMm: mm("Larghezza"),
    depthMm: mm("Profondità"),
    clearHeightMm: mm("Altezza utile"),
    totalHeightMm: mm("Altezza totale"),
    colorId: optionalId,
    fabricId: optionalId,
    polygon: z.array(point, { error: "Sagoma non valida" }).optional(),
    positionText: z
      .string()
      .trim()
      .max(2000, { error: "Descrizione della posizione troppo lunga" })
      .default("")
      .transform(lf),
    scaleLine: scaleLineSchema.optional(),
    prompt: z
      .string()
      .trim()
      .max(20000, { error: "Prompt troppo lungo" })
      .optional()
      .transform((v) => (v ? lf(v) : undefined)),
    providerId: z.enum(PROVIDER_IDS as [string, ...string[]], { error: "Fornitore sconosciuto" }),
    model: z.string({ error: "Indica il modello" }).trim().min(1, { error: "Indica il modello" }),
    quality: z.enum(["low", "medium", "high"], { error: "Qualità non valida (low, medium o high)" }),
    variantsRequested: z
      .number({ error: "Numero di varianti non valido" })
      .int({ error: "Le varianti devono essere tra 1 e 6" })
      .min(1, { error: "Le varianti devono essere tra 1 e 6" })
      .max(6, { error: "Le varianti devono essere tra 1 e 6" }),
    disclaimer: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (!v.photo && !v.sourceRenderId) {
      ctx.addIssue({ code: "custom", message: PHOTO_REQUIRED, path: ["photo"] });
    }
    if (v.photo && v.sourceRenderId) {
      ctx.addIssue({ code: "custom", message: PHOTO_AND_SOURCE, path: ["photo"] });
    }
    if (!v.polygon && !v.positionText) {
      ctx.addIssue({ code: "custom", message: POSITION_REQUIRED, path: ["positionText"] });
    }
  });

export type CreateRenderInput = z.input<typeof CreateRenderInput>;

function parse(input: unknown) {
  const r = CreateRenderInput.safeParse(input);
  if (!r.success) throw new RenderInputError(r.error.issues[0]?.message ?? "Dati non validi");
  return r.data;
}

async function findFinish(id: string | undefined, kind: "COLORE" | "TESSUTO", missing: string) {
  if (!id) return null;
  const f = await db.finish.findUnique({ where: { id } });
  if (!f || f.kind !== kind) throw new RenderInputError(missing);
  return f;
}

/**
 * Foto normalizzata del nuovo render: quella caricata (normalizzata qui) oppure
 * quella già normalizzata del render di partenza, riletta così com'è.
 * Si copia il file invece di condividerne l'URL: ogni render resta
 * autosufficiente e l'eliminazione del render di partenza non lo rompe.
 */
async function photoFor(
  photo: Buffer | File | undefined,
  sourceRenderId: string | undefined,
): Promise<{ jpeg: Buffer; width: number; height: number }> {
  if (sourceRenderId) {
    const src = await db.render.findUnique({ where: { id: sourceRenderId } });
    if (!src) throw new SourceRenderNotFoundError(SOURCE_NOT_FOUND);
    let jpeg: Buffer;
    try {
      jpeg = await getFile(src.photoUrl);
    } catch {
      throw new RenderInputError("Foto del render di partenza non disponibile: caricala di nuovo");
    }
    return { jpeg, width: src.photoWidth, height: src.photoHeight };
  }
  if (!photo) throw new RenderInputError(PHOTO_REQUIRED);
  const raw = Buffer.isBuffer(photo) ? photo : Buffer.from(await photo.arrayBuffer());
  try {
    return await normalizePhoto(raw);
  } catch {
    throw new RenderInputError("Foto non leggibile: usa un file JPEG, PNG o WebP");
  }
}

export async function createRender(input: CreateRenderInput): Promise<Render> {
  const data = parse(input);

  let polygon: Point[] | undefined;
  if (data.polygon) {
    const v = validatePolygon(data.polygon);
    if (!v.ok) throw new RenderInputError(v.error);
    polygon = v.points;
  }

  const product = await db.product.findUnique({ where: { id: data.productId } });
  if (!product) throw new RenderInputError("Prodotto non trovato");
  const [color, fabric, referenceCount] = await Promise.all([
    findFinish(data.colorId, "COLORE", "Colore non trovato"),
    findFinish(data.fabricId, "TESSUTO", "Tessuto non trovato"),
    db.referenceImage.count({ where: { productId: product.id } }),
  ]);

  const { jpeg, width, height } = await photoFor(data.photo, data.sourceRenderId);

  const provider = getProvider(data.providerId);
  const prompt =
    data.prompt ??
    buildPrompt({
      product: {
        name: product.name,
        mountType: product.mountType as MountType,
        coverType: product.coverType as CoverType,
        aiDescription: product.aiDescription,
      },
      dims: {
        widthMm: data.widthMm,
        depthMm: data.depthMm,
        clearHeightMm: data.clearHeightMm,
        totalHeightMm: data.totalHeightMm,
      },
      color: color ? { name: color.name, code: color.code } : undefined,
      fabric: fabric ? { name: fabric.name, code: fabric.code } : undefined,
      positionText: data.positionText,
      // La maschera arriva sempre al modello quando c'è una sagoma; il prompt parla di
      // "area mascherata" solo se il modello la applica, altrimenti la descrive come guida.
      hasMask: !!polygon && provider.supportsMask,
      maskHint: !!polygon && !provider.supportsMask,
      scale: data.scaleLine
        ? {
            lengthMm: data.scaleLine.lengthMm,
            pixelLength: Math.hypot(
              (data.scaleLine.b.x - data.scaleLine.a.x) * width,
              (data.scaleLine.b.y - data.scaleLine.a.y) * height,
            ),
            photoWidth: width,
          }
        : undefined,
      referenceCount,
    });

  const id = randomUUID();
  const photoUrl = await putFile(`renders/${id}/photo.jpg`, jpeg, "image/jpeg");

  return db.render.create({
    data: {
      id,
      clientRef: data.clientRef,
      photoUrl,
      photoWidth: width,
      photoHeight: height,
      productId: product.id,
      productName: product.name,
      widthMm: data.widthMm,
      depthMm: data.depthMm,
      clearHeightMm: data.clearHeightMm,
      totalHeightMm: data.totalHeightMm,
      colorId: color?.id ?? null,
      fabricId: fabric?.id ?? null,
      polygon: polygon ?? undefined,
      positionText: data.positionText,
      scaleLine: data.scaleLine ?? undefined,
      prompt,
      providerId: data.providerId,
      model: data.model,
      quality: data.quality,
      variantsRequested: data.variantsRequested,
      disclaimer: data.disclaimer,
    },
  });
}

const ERROR_MESSAGES: Record<string, string> = {
  config: "Fornitore non configurato: manca la chiave API",
  rejected: "Il fornitore ha rifiutato la richiesta",
  timeout: "Tempo scaduto, riprova",
};
const GENERIC_ERROR = "Errore del fornitore, riprova";

function errorMessage(err: unknown): string {
  return err instanceof ProviderError ? (ERROR_MESSAGES[err.kind] ?? GENERIC_ERROR) : GENERIC_ERROR;
}

function storedPolygon(value: unknown): Point[] | undefined {
  if (value == null) return undefined;
  const parsed = z.array(point).safeParse(value);
  if (!parsed.success) throw new Error("Sagoma salvata non valida");
  const v = validatePolygon(parsed.data);
  if (!v.ok) throw new Error(v.error);
  return v.points;
}

const QUALITIES: ImageQuality[] = ["low", "medium", "high"];

/**
 * Genera una variante del render. Gli errori di generazione non vengono
 * rilanciati: la variante resta FAILED con un messaggio italiano.
 * Lancia solo se il render non esiste.
 */
export async function generateVariant(
  renderId: string,
  deps: { provider?: ImageProvider } = {},
): Promise<Variant> {
  const render = await db.render.findUnique({ where: { id: renderId } });
  if (!render) throw new RenderInputError("Render non trovato");

  const hasPolygon = render.polygon != null;
  const variant = await db.variant.create({
    data: { renderId: render.id, status: "PENDING", protected: hasPolygon },
  });

  try {
    const provider = deps.provider ?? getProvider(render.providerId);
    const W = render.photoWidth;
    const H = render.photoHeight;
    const polygon = storedPolygon(render.polygon);

    const [photo, references] = await Promise.all([
      getFile(render.photoUrl),
      render.productId
        ? db.referenceImage
            .findMany({ where: { productId: render.productId }, orderBy: { sortOrder: "asc" } })
            .then((refs) => Promise.all(refs.map((r) => getFile(r.url))))
        : Promise.resolve([] as Buffer[]),
    ]);

    const mask = polygon ? await polygonToMask(polygon, W, H) : undefined;
    const size = pickProviderSize(W, H, provider.supportedSizes);
    const [photoP, maskP] = await Promise.all([
      toProviderSize(photo, size),
      // Inviata anche ai fornitori che non la applicano (supportsMask false): serve
      // al modello per sapere dove posizionare la pergola.
      mask ? toProviderSize(mask, size) : Promise.resolve(undefined),
    ]);

    const quality = QUALITIES.includes(render.quality as ImageQuality)
      ? (render.quality as ImageQuality)
      : "high";
    // L'alfa sfumato (EDT) si calcola una volta sola, in parallelo alla chiamata al fornitore.
    const [generated, alpha] = await Promise.all([
      provider.generate({ photo: photoP, mask: maskP, references, prompt: render.prompt, model: render.model, quality }),
      mask ? featheredAlpha(mask, W, H) : Promise.resolve(undefined),
    ]);

    const full = await fromProviderSize(generated, W, H);
    const out = mask
      ? await composite(photo, full, mask, W, H, { disclaimer: render.disclaimer, alpha })
      : render.disclaimer
        ? await addDisclaimer(full, W, H)
        : await toJpeg(full);

    const imageUrl = await putFile(`renders/${render.id}/${variant.id}.jpg`, out, "image/jpeg");
    return await db.variant.update({
      where: { id: variant.id },
      data: { status: "DONE", imageUrl, protected: hasPolygon, error: null },
    });
  } catch (err) {
    console.error(`Generazione variante ${variant.id} fallita:`, err);
    const failed = { status: "FAILED" as const, error: errorMessage(err) };
    try {
      return await db.variant.update({ where: { id: variant.id }, data: failed });
    } catch (dbErr) {
      // Non rilanciare: la riga resta PENDING e isStale() la mostrerà scaduta.
      console.error(`Salvataggio dell'errore della variante ${variant.id} fallito:`, dbErr);
      return { ...variant, ...failed, imageUrl: null };
    }
  }
}

/** Oltre questo tempo una variante ancora PENDING è considerata bloccata. */
export const STALE_AFTER_MS = 6 * 60 * 1000;

/** true per le varianti PENDING create da più di 6 minuti (da mostrare come FAILED). */
export function isStale(
  variant: Pick<Variant, "status" | "createdAt"> | { status: string; createdAt: Date },
  now: Date = new Date(),
): boolean {
  return variant.status === "PENDING" && now.getTime() - variant.createdAt.getTime() > STALE_AFTER_MS;
}

/* ---- Lettura del multipart di POST /api/renders ---- */

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
/** Limite del corpo della richiesta: uguale a experimental.proxyClientMaxBodySize in next.config.ts. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;
export const PHOTO_TOO_LARGE =
  "La foto è troppo grande (max 4 MB): riprova, l'app la ridimensiona automaticamente";

/** Errore 413: foto troppo grande. */
export class PhotoTooLargeError extends RenderInputError {}

function str(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === "string" ? v : undefined;
}

function num(form: FormData, key: string): number | undefined {
  const v = str(form, key)?.trim();
  return v ? Number(v) : undefined;
}

function json(form: FormData, key: string, error: string): unknown {
  const v = str(form, key)?.trim();
  if (!v) return undefined;
  try {
    return JSON.parse(v);
  } catch {
    throw new RenderInputError(error);
  }
}

/**
 * Converte il FormData di POST /api/renders nell'input di createRender.
 * Serve esattamente uno tra `photo` (file) e `sourceRenderId` (riusa la foto
 * di un render esistente, per "Duplica e modifica").
 * I campi mancanti di fornitore, modello, qualità e varianti prendono i
 * valori di `defaults` (le impostazioni).
 */
export function renderInputFromForm(
  form: FormData,
  defaults: { providerId: string; model: string; quality: string; variants: number },
): CreateRenderInput {
  const entry = form.get("photo");
  const photo = entry instanceof File && entry.size > 0 ? entry : undefined;
  const sourceRenderId = str(form, "sourceRenderId")?.trim() || undefined;
  if (photo && sourceRenderId) throw new RenderInputError(PHOTO_AND_SOURCE);
  if (!photo && !sourceRenderId) throw new RenderInputError(PHOTO_REQUIRED);
  if (photo && photo.size > MAX_PHOTO_BYTES) throw new PhotoTooLargeError(PHOTO_TOO_LARGE);
  return {
    clientRef: str(form, "clientRef") as string,
    photo,
    sourceRenderId,
    productId: str(form, "productId") as string,
    widthMm: num(form, "widthMm") as number,
    depthMm: num(form, "depthMm") as number,
    clearHeightMm: num(form, "clearHeightMm") as number,
    totalHeightMm: num(form, "totalHeightMm") as number,
    colorId: str(form, "colorId"),
    fabricId: str(form, "fabricId"),
    polygon: json(form, "polygon", "Sagoma non valida") as Point[] | undefined,
    positionText: str(form, "positionText") ?? "",
    scaleLine: json(form, "scaleLine", "Linea di riferimento non valida") as CreateRenderInput["scaleLine"],
    prompt: str(form, "prompt"),
    providerId: str(form, "providerId")?.trim() || defaults.providerId,
    model: str(form, "model")?.trim() || defaults.model,
    quality: (str(form, "quality")?.trim() || defaults.quality) as ImageQuality,
    variantsRequested: num(form, "variantsRequested") ?? defaults.variants,
    disclaimer: str(form, "disclaimer") === "true",
  };
}
