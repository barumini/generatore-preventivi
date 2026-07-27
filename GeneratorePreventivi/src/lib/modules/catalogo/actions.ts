"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { catalogItemSchema } from "@/lib/shared/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCatalogItem(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const parsed = catalogItemSchema.safeParse({
    description: formData.get("description"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.catalogItem.create({ data: parsed.data });
  revalidatePath("/catalogo");
  return { ok: true };
}

export async function updateCatalogItem(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const parsed = catalogItemSchema.safeParse({
    description: formData.get("description"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.catalogItem.update({ where: { id }, data: parsed.data });
  revalidatePath("/catalogo");
  return { ok: true };
}

export async function toggleCatalogItemActive(id: string) {
  await requireUser();
  const item = await prisma.catalogItem.findUniqueOrThrow({ where: { id } });
  await prisma.catalogItem.update({
    where: { id },
    data: { active: !item.active },
  });
  revalidatePath("/catalogo");
}
