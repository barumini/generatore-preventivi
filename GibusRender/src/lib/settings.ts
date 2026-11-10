import { z } from "zod";
import { db } from "@/lib/db";
import type { Settings } from "@/generated/prisma/client";

export type { Settings };

const SETTINGS_ID = 1;
const PROVIDER_IDS = ["openai", "openrouter", "gemini", "fal"] as const;

export const DEFAULT_SETTINGS: Omit<Settings, "id"> = {
  // Predefinito economico: FLUX.3 Klein su fal.ai, ~0,009 $ a immagine (confronto del 2026-11-10).
  activeProviderId: "fal",
  activeModel: "blackforestlabs/flux-3/klein/edit-image",
  quality: "low",
  enabledProviders: ["openai", "openrouter", "gemini", "fal"],
  defaultVariants: 3,
  maxPhotoSide: 1280,
};

const schema = z
  .object({
    activeProviderId: z.enum(PROVIDER_IDS, { error: "Fornitore attivo sconosciuto" }),
    activeModel: z.string().trim().min(1, { error: "Indicare il modello" }),
    quality: z.enum(["low", "medium", "high"], { error: "Qualità non valida (low, medium o high)" }),
    enabledProviders: z
      .array(z.enum(PROVIDER_IDS, { error: "Fornitore sconosciuto" }))
      .min(1, { error: "Abilitare almeno un fornitore" })
      .transform((a) => [...new Set(a)]),
    defaultVariants: z
      .number({ error: "Numero di varianti non valido" })
      .int({ error: "Il numero di varianti deve essere intero" })
      .min(1, { error: "Le varianti devono essere tra 1 e 6" })
      .max(6, { error: "Le varianti devono essere tra 1 e 6" }),
    maxPhotoSide: z
      .number({ error: "Lato lungo della foto non valido" })
      .int({ error: "Il lato lungo della foto deve essere tra 640 e 3000 px" })
      .min(640, { error: "Il lato lungo della foto deve essere tra 640 e 3000 px" })
      .max(3000, { error: "Il lato lungo della foto deve essere tra 640 e 3000 px" }),
  })
  .refine((s) => s.enabledProviders.includes(s.activeProviderId), {
    error: "Il fornitore attivo deve essere tra quelli abilitati",
    path: ["activeProviderId"],
  });

/** Legge le impostazioni, creando la riga 1 con i valori predefiniti se manca. */
export async function getSettings(): Promise<Settings> {
  return db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...DEFAULT_SETTINGS },
    update: {},
  });
}

/** Aggiorna le impostazioni dopo averle validate; lancia un Error in italiano se non valide. */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const { id: _ignored, ...rest } = { ...current, ...patch };
  void _ignored;
  const parsed = schema.safeParse(rest);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  return db.settings.update({ where: { id: SETTINGS_ID }, data: parsed.data });
}
