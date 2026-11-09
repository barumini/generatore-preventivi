import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: number;
  activeProviderId: string;
  activeModel: string;
  quality: string;
  enabledProviders: string[];
  defaultVariants: number;
};

const store = vi.hoisted(() => ({ rows: new Map<number, Row>() }));

vi.mock("@/lib/db", () => ({
  db: {
    settings: {
      upsert: vi.fn(async ({ where, create }: { where: { id: number }; create: Omit<Row, "id"> }) => {
        const found = store.rows.get(where.id);
        if (found) return { ...found };
        const row = { id: where.id, ...create } as Row;
        store.rows.set(row.id, row);
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Partial<Row> }) => {
        const found = store.rows.get(where.id);
        if (!found) throw new Error("not found");
        const row = { ...found, ...data, id: found.id };
        store.rows.set(row.id, row);
        return { ...row };
      }),
    },
  },
}));

import { getSettings, updateSettings } from "@/lib/settings";

beforeEach(() => store.rows.clear());

describe("settings", () => {
  it("crea la riga 1 con i valori predefiniti", async () => {
    const s = await getSettings();
    expect(s).toEqual({
      id: 1,
      activeProviderId: "openai",
      activeModel: "gpt-image-2",
      quality: "high",
      enabledProviders: ["openai", "openrouter"],
      defaultVariants: 3,
    });
    expect(store.rows.size).toBe(1);
    expect(await getSettings()).toEqual(s);
  });

  it("aggiorna i campi validi", async () => {
    const s = await updateSettings({
      activeProviderId: "openrouter",
      activeModel: " google/gemini-2.5-flash-image ",
      defaultVariants: 6,
      quality: "medium",
    });
    expect(s.activeProviderId).toBe("openrouter");
    expect(s.activeModel).toBe("google/gemini-2.5-flash-image");
    expect(s.defaultVariants).toBe(6);
    expect(s.quality).toBe("medium");
    expect((await getSettings()).activeProviderId).toBe("openrouter");
  });

  it("rifiuta un fornitore attivo non abilitato", async () => {
    await expect(updateSettings({ enabledProviders: ["openrouter"] })).rejects.toThrow(/abilitat/);
    await expect(
      updateSettings({ activeProviderId: "openai", enabledProviders: ["openrouter"] }),
    ).rejects.toThrow();
    expect((await getSettings()).enabledProviders).toEqual(["openai", "openrouter"]);
  });

  it("rifiuta varianti fuori da 1–6 e valori sconosciuti", async () => {
    await expect(updateSettings({ defaultVariants: 0 })).rejects.toThrow();
    await expect(updateSettings({ defaultVariants: 7 })).rejects.toThrow();
    await expect(updateSettings({ defaultVariants: 2.5 })).rejects.toThrow();
    await expect(updateSettings({ quality: "ultra" })).rejects.toThrow();
    await expect(updateSettings({ activeProviderId: "x", enabledProviders: ["x"] })).rejects.toThrow();
    await expect(updateSettings({ activeModel: "  " })).rejects.toThrow();
  });

  it("ignora un tentativo di cambiare l'id", async () => {
    const s = await updateSettings({ id: 5, defaultVariants: 2 });
    expect(s.id).toBe(1);
    expect(store.rows.has(5)).toBe(false);
  });
});
