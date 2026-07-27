"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { clientSchema } from "@/lib/shared/validation";
import { generateUniqueCodePrefix } from "./codePrefix";

export type ActionResult = { ok: true } | { ok: false; error: string };

function readForm(formData: FormData) {
  return {
    ragioneSociale: formData.get("ragioneSociale"),
    indirizzo: formData.get("indirizzo"),
    piva: formData.get("piva"),
    codiceSdi: formData.get("codiceSdi"),
    referenteDih: formData.get("referenteDih"),
    codePrefix: formData.get("codePrefix"),
  };
}

export async function createClient(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const parsed = clientSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { codePrefix, ...rest } = parsed.data;
  const finalPrefix = codePrefix
    ? codePrefix.toUpperCase()
    : await generateUniqueCodePrefix(parsed.data.ragioneSociale);

  if (codePrefix) {
    const taken = await prisma.client.findFirst({ where: { codePrefix: finalPrefix } });
    if (taken) {
      return { ok: false, error: `Il codice "${finalPrefix}" è già in uso da un altro cliente.` };
    }
  }

  await prisma.client.create({ data: { ...rest, codePrefix: finalPrefix } });
  revalidatePath("/clienti");
  return { ok: true };
}

export async function updateClient(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const parsed = clientSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { codePrefix, ...rest } = parsed.data;
  const finalPrefix = codePrefix
    ? codePrefix.toUpperCase()
    : await generateUniqueCodePrefix(parsed.data.ragioneSociale, id);

  const taken = await prisma.client.findFirst({
    where: { codePrefix: finalPrefix, id: { not: id } },
  });
  if (taken) {
    return { ok: false, error: `Il codice "${finalPrefix}" è già in uso da un altro cliente.` };
  }

  await prisma.client.update({ where: { id }, data: { ...rest, codePrefix: finalPrefix } });
  revalidatePath("/clienti");
  return { ok: true };
}

export async function toggleClientActive(id: string) {
  await requireUser();
  const client = await prisma.client.findUniqueOrThrow({ where: { id } });
  await prisma.client.update({ where: { id }, data: { active: !client.active } });
  revalidatePath("/clienti");
}
