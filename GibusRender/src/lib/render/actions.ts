"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/catalog/actions";
import { deleteFile } from "@/lib/storage";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Segna come scelta una variante completata del render. */
export async function chooseVariant(renderId: string, variantId: string): Promise<ActionResult> {
  if (typeof renderId !== "string" || typeof variantId !== "string") return fail("Dati non validi");
  const render = await db.render.findUnique({ where: { id: renderId } });
  if (!render) return fail("Render non trovato");
  const variant = await db.variant.findUnique({ where: { id: variantId } });
  if (!variant) return fail("Variante non trovata");
  if (variant.renderId !== render.id) return fail("La variante non appartiene a questo render");
  if (variant.status !== "DONE") return fail("Si può scegliere solo una variante completata");

  await db.render.update({ where: { id: render.id }, data: { chosenVariantId: variant.id } });
  revalidatePath(`/render/${render.id}`);
  revalidatePath("/");
  return { ok: true };
}

/** Cancella i file in modo "best effort": un file che non si elimina non blocca la cancellazione. */
async function removeFiles(urls: (string | null | undefined)[]): Promise<void> {
  for (const url of urls) {
    if (!url) continue;
    try {
      await deleteFile(url);
    } catch (err) {
      console.error(`Eliminazione del file ${url} non riuscita:`, err);
    }
  }
}

/** Elimina una variante e il suo file; se era la scelta, il render resta senza variante scelta. */
export async function deleteVariant(variantId: string): Promise<ActionResult> {
  if (typeof variantId !== "string" || !variantId) return fail("Dati non validi");
  const variant = await db.variant.findUnique({ where: { id: variantId } });
  if (!variant) return fail("Variante non trovata");
  const render = await db.render.findUnique({ where: { id: variant.renderId } });
  if (render?.chosenVariantId === variant.id) {
    await db.render.update({ where: { id: render.id }, data: { chosenVariantId: null } });
  }
  await db.variant.delete({ where: { id: variant.id } });
  await removeFiles([variant.imageUrl]);
  revalidatePath(`/render/${variant.renderId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Elimina un render con tutte le sue varianti, la foto e le immagini generate. */
export async function deleteRender(renderId: string): Promise<ActionResult> {
  if (typeof renderId !== "string" || !renderId) return fail("Dati non validi");
  const render = await db.render.findUnique({ where: { id: renderId }, include: { variants: true } });
  if (!render) return fail("Render non trovato");
  await db.render.delete({ where: { id: render.id } }); // le varianti seguono (onDelete: Cascade)
  await removeFiles([render.photoUrl, ...render.variants.map((v) => v.imageUrl)]);
  revalidatePath(`/render/${render.id}`);
  revalidatePath("/");
  return { ok: true };
}
