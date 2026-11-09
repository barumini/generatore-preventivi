"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/catalog/actions";
import { updateSettings } from "@/lib/settings";

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/** Salva le impostazioni; la validazione (messaggi italiani) è in updateSettings. */
export async function saveSettings(form: FormData): Promise<ActionResult> {
  try {
    await updateSettings({
      activeProviderId: str(form, "activeProviderId") as "openai",
      activeModel: str(form, "activeModel"),
      quality: str(form, "quality"),
      enabledProviders: form.getAll("enabledProviders").filter((v): v is string => typeof v === "string"),
      defaultVariants: Number(str(form, "defaultVariants")),
    });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Errore imprevisto" };
  }
}
