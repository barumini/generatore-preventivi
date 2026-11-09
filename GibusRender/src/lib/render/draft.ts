// Bozza di un nuovo render a partire da uno esistente ("Duplica e modifica").
// Solo lato server: restituisce dati semplici da passare al modulo client.
import { db } from "@/lib/db";
import type { Point, ScaleLine } from "./geometry";

export type RenderDraft = {
  /** Render da cui riusare la foto (campo sourceRenderId di POST /api/renders). */
  sourceRenderId: string;
  clientRef: string;
  /** null se il prodotto è stato eliminato dal catalogo: va scelto di nuovo. */
  productId: string | null;
  productName: string;
  widthMm: number;
  depthMm: number;
  clearHeightMm: number;
  totalHeightMm: number;
  colorId: string | null;
  fabricId: string | null;
  polygon: Point[] | null;
  positionText: string;
  scaleLine: ScaleLine | null;
  prompt: string;
  providerId: string;
  model: string;
  quality: string;
  variantsRequested: number;
  disclaimer: boolean;
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
};

/** Tutti i parametri del render tranne la variante scelta; null se il render non esiste. */
export async function getRenderDraft(renderId: string): Promise<RenderDraft | null> {
  const r = await db.render.findUnique({ where: { id: renderId } });
  if (!r) return null;
  const product = r.productId ? await db.product.findUnique({ where: { id: r.productId } }) : null;
  return {
    sourceRenderId: r.id,
    clientRef: r.clientRef,
    productId: product ? product.id : null,
    productName: r.productName,
    widthMm: r.widthMm,
    depthMm: r.depthMm,
    clearHeightMm: r.clearHeightMm,
    totalHeightMm: r.totalHeightMm,
    colorId: r.colorId ?? null,
    fabricId: r.fabricId ?? null,
    polygon: (r.polygon as Point[] | null) ?? null,
    positionText: r.positionText,
    scaleLine: (r.scaleLine as ScaleLine | null) ?? null,
    prompt: r.prompt,
    providerId: r.providerId,
    model: r.model,
    quality: r.quality,
    variantsRequested: r.variantsRequested,
    disclaimer: r.disclaimer,
    photoUrl: r.photoUrl,
    photoWidth: r.photoWidth,
    photoHeight: r.photoHeight,
  };
}
