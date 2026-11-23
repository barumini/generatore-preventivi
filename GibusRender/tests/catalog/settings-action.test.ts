import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSettings = vi.hoisted(() => vi.fn());
vi.mock("@/lib/settings", () => ({ updateSettings }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveSettings } from "@/lib/settings-actions";

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  updateSettings.mockReset();
});

describe("saveSettings", () => {
  it("passa a updateSettings i valori del modulo con tipi corretti", async () => {
    updateSettings.mockResolvedValue({});
    const res = await saveSettings(
      form({
        activeProviderId: "openrouter",
        activeModel: " google/gemini ",
        quality: "medium",
        enabledProviders: ["openai", "openrouter"],
        defaultVariants: "4",
        maxPhotoSide: "1280",
      }),
    );
    expect(res).toEqual({ ok: true });
    expect(updateSettings).toHaveBeenCalledWith({
      activeProviderId: "openrouter",
      activeModel: " google/gemini ",
      quality: "medium",
      enabledProviders: ["openai", "openrouter"],
      defaultVariants: 4,
      maxPhotoSide: 1280,
    });
  });

  it("mostra il messaggio d'errore italiano di updateSettings", async () => {
    updateSettings.mockRejectedValue(new Error("Il fornitore attivo deve essere tra quelli abilitati"));
    const res = await saveSettings(form({ activeProviderId: "openai", defaultVariants: "3" }));
    expect(res).toEqual({ ok: false, error: "Il fornitore attivo deve essere tra quelli abilitati" });
  });

  it("un numero di varianti non numerico diventa NaN e viene rifiutato da updateSettings", async () => {
    updateSettings.mockImplementation(async (p: { defaultVariants: number }) => {
      if (Number.isNaN(p.defaultVariants)) throw new Error("Numero di varianti non valido");
    });
    const res = await saveSettings(form({ defaultVariants: "abc" }));
    expect(res).toEqual({ ok: false, error: "Numero di varianti non valido" });
  });
});
