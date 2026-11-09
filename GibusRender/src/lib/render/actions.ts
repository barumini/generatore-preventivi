"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/catalog/actions";

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
