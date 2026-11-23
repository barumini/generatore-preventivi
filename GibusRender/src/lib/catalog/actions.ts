"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { putFile } from "@/lib/storage";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
const REFERENCE_MAX_SIDE = 2000;
const IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Errore imprevisto";
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dati non validi";
}

function revalidateCatalog(productId?: string): void {
  revalidatePath("/catalogo");
  revalidatePath("/catalogo/finiture");
  if (productId) revalidatePath(`/catalogo/${productId}`);
}

// --- Prodotti ------------------------------------------------------------------

function measure(label: string) {
  const message = `${label}: serve un numero intero tra 500 e 15000 mm`;
  return z
    .string()
    .trim()
    .transform((s) => (s === "" ? NaN : Number(s)))
    .pipe(z.number({ error: message }).int({ error: message }).min(500, { error: message }).max(15000, { error: message }));
}

const productSchema = z.object({
  name: z.string().trim().min(1, { error: "Il nome è obbligatorio" }),
  mountType: z.enum(["ADDOSSATA", "AUTOPORTANTE"], { error: "Tipo di installazione non valido" }),
  coverType: z.enum(["TELO", "LAMELLE_ORIENTABILI", "LAMELLE_IMPACCHETTAMENTO"], { error: "Tipo di copertura non valido" }),
  aiDescription: z
    .string()
    .trim()
    .min(50, { error: "La descrizione per l'IA deve avere almeno 50 caratteri" }),
  widthMm: measure("Larghezza"),
  depthMm: measure("Profondità"),
  clearHeightMm: measure("Altezza libera"),
  totalHeightMm: measure("Altezza totale"),
});

/** Crea (senza `id` nel modulo) o aggiorna un prodotto, con finiture compatibili e predefinite. */
export async function saveProduct(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse({
    name: formString(form, "name"),
    mountType: formString(form, "mountType"),
    coverType: formString(form, "coverType"),
    aiDescription: formString(form, "aiDescription"),
    widthMm: formString(form, "widthMm"),
    depthMm: formString(form, "depthMm"),
    clearHeightMm: formString(form, "clearHeightMm"),
    totalHeightMm: formString(form, "totalHeightMm"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const id = formString(form, "id") || null;
  const finishIds = [...new Set(form.getAll("finishIds").filter((v): v is string => typeof v === "string" && v !== ""))];
  const defaultColorId = formString(form, "defaultColorId") || null;
  const defaultFabricId = formString(form, "defaultFabricId") || null;

  try {
    const finishes = finishIds.length
      ? ((await db.finish.findMany({ where: { id: { in: finishIds } } })) as { id: string; kind: string }[])
      : [];
    if (finishes.length !== finishIds.length) return fail("Una delle finiture scelte non esiste più");
    const kindOf = new Map(finishes.map((f) => [f.id, f.kind]));
    if (defaultColorId && (!finishIds.includes(defaultColorId) || kindOf.get(defaultColorId) !== "COLORE")) {
      return fail("Il colore predefinito deve essere un colore tra le finiture compatibili");
    }
    if (defaultFabricId && (!finishIds.includes(defaultFabricId) || kindOf.get(defaultFabricId) !== "TESSUTO")) {
      return fail("Il tessuto predefinito deve essere un tessuto tra le finiture compatibili");
    }

    const data = { ...parsed.data, defaultColorId, defaultFabricId };
    let productId: string;
    if (id) {
      if (!(await db.product.findUnique({ where: { id } }))) return fail("Prodotto non trovato");
      await db.product.update({ where: { id }, data });
      productId = id;
    } else {
      productId = (await db.product.create({ data })).id;
    }
    await db.$transaction([
      db.productFinish.deleteMany({ where: { productId } }),
      db.productFinish.createMany({ data: finishIds.map((finishId) => ({ productId, finishId })) }),
    ]);
    revalidateCatalog(productId);
    return { ok: true, id: productId };
  } catch (err) {
    if (isUniqueViolation(err)) return fail("Esiste già un prodotto con questo nome");
    return fail(errorMessage(err));
  }
}

/** Elimina il prodotto; i render collegati restano (productId a NULL, nome e misure conservati). */
export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await db.product.delete({ where: { id } });
    revalidateCatalog();
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// --- Finiture ------------------------------------------------------------------

const finishSchema = z.object({
  kind: z.enum(["COLORE", "TESSUTO"], { error: "Tipo di finitura non valido" }),
  name: z.string().trim().min(1, { error: "Il nome è obbligatorio" }),
  code: z.string().trim().min(1, { error: "Il codice è obbligatorio" }),
  swatchHex: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Il colore deve essere nel formato #RRGGBB" }).nullable()),
});

export async function saveFinish(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = finishSchema.safeParse({
    kind: formString(form, "kind"),
    name: formString(form, "name"),
    code: formString(form, "code"),
    swatchHex: formString(form, "swatchHex"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const id = formString(form, "id") || null;
  try {
    let finishId: string;
    if (id) {
      if (!(await db.finish.findUnique({ where: { id } }))) return fail("Finitura non trovata");
      await db.finish.update({ where: { id }, data: parsed.data });
      finishId = id;
    } else {
      finishId = (await db.finish.create({ data: parsed.data })).id;
    }
    revalidateCatalog();
    return { ok: true, id: finishId };
  } catch (err) {
    if (isUniqueViolation(err)) return fail("Esiste già una finitura con questo codice");
    return fail(errorMessage(err));
  }
}

/** Una finitura usata come predefinita non si elimina; altrimenti i render conservano il resto (SetNull). */
export async function deleteFinish(id: string): Promise<ActionResult> {
  try {
    const users = (await db.product.findMany({
      where: { OR: [{ defaultColorId: id }, { defaultFabricId: id }] },
      select: { name: true },
    })) as { name: string }[];
    if (users.length > 0) {
      return fail(`Finitura in uso come predefinita in: ${users.map((p) => p.name).join(", ")}`);
    }
    await db.finish.delete({ where: { id } });
    revalidateCatalog();
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// --- Immagini di riferimento ----------------------------------------------------

/** Normalizza (ruota secondo EXIF, lato lungo max 2000 px, PNG) e aggiunge in coda. */
export async function addReferenceImage(productId: string, file: File, label?: string): Promise<ActionResult> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) return fail("Scegliere un file immagine");
  if (file.size > MAX_REFERENCE_BYTES) return fail("Il file supera il limite di 4 MB");
  try {
    if (!(await db.product.findUnique({ where: { id: productId } }))) return fail("Prodotto non trovato");
    const input = Buffer.from(await file.arrayBuffer());
    let normalized: Buffer;
    try {
      const format = (await sharp(input).metadata()).format;
      if (!format || !IMAGE_FORMATS.has(format)) return fail("Il file non è un'immagine supportata (JPG, PNG, WebP o GIF)");
      normalized = await sharp(input)
        .rotate()
        .resize({ width: REFERENCE_MAX_SIDE, height: REFERENCE_MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch {
      return fail("Il file non è un'immagine valida");
    }
    const existing = (await db.referenceImage.findMany({ where: { productId } })) as { sortOrder: number }[];
    const sortOrder = existing.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;
    const url = await putFile(`references/${productId}/${randomUUID()}.png`, normalized, "image/png");
    await db.referenceImage.create({ data: { productId, url, label: label?.trim() || "Riferimento", sortOrder } });
    revalidateCatalog(productId);
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function removeReferenceImage(id: string): Promise<ActionResult> {
  try {
    const ref = (await db.referenceImage.findUnique({ where: { id } })) as { productId: string } | null;
    if (!ref) return fail("Immagine non trovata");
    await db.referenceImage.delete({ where: { id } });
    revalidateCatalog(ref.productId);
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/** Sposta un riferimento di una posizione; riscrive l'ordine di tutti per evitare parità. */
export async function moveReferenceImage(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const ref = (await db.referenceImage.findUnique({ where: { id } })) as { productId: string } | null;
    if (!ref) return fail("Immagine non trovata");
    const siblings = (await db.referenceImage.findMany({
      where: { productId: ref.productId },
      orderBy: { sortOrder: "asc" },
    })) as { id: string }[];
    const from = siblings.findIndex((r) => r.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to >= 0 && to < siblings.length) {
      const ids = siblings.map((r) => r.id);
      [ids[from], ids[to]] = [ids[to], ids[from]];
      await db.$transaction(ids.map((rid, sortOrder) => db.referenceImage.update({ where: { id: rid }, data: { sortOrder } })));
      revalidateCatalog(ref.productId);
    }
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}
