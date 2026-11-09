import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Finto Prisma in memoria -------------------------------------------------

type Row = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  renders: new Map<string, Row>(),
  variants: new Map<string, Row>(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => {
  const clone = <T>(v: T): T => structuredClone(v);
  const model = (map: Map<string, Row>) => ({
    findUnique: async ({ where }: { where: { id: string } }) => {
      const r = map.get(where.id);
      return r ? clone(r) : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = map.get(where.id);
      if (!row) throw new Error("not found");
      const next = { ...row, ...clone(data) } as Row;
      map.set(row.id, next);
      return clone(next);
    },
  });
  return { db: { render: model(store.renders), variant: model(store.variants) } };
});

import { chooseVariant } from "@/lib/render/actions";

beforeEach(() => {
  store.renders.clear();
  store.variants.clear();
  store.renders.set("r1", { id: "r1", clientRef: "Rossi", chosenVariantId: null });
  store.renders.set("r2", { id: "r2", clientRef: "Bianchi", chosenVariantId: null });
  store.variants.set("v1", { id: "v1", renderId: "r1", status: "DONE", imageUrl: "/api/files/a.jpg" });
  store.variants.set("v2", { id: "v2", renderId: "r2", status: "DONE", imageUrl: "/api/files/b.jpg" });
  store.variants.set("v3", { id: "v3", renderId: "r1", status: "FAILED", imageUrl: null });
  store.variants.set("v4", { id: "v4", renderId: "r1", status: "PENDING", imageUrl: null });
});

describe("chooseVariant", () => {
  it("imposta chosenVariantId su una variante DONE dello stesso render", async () => {
    const res = await chooseVariant("r1", "v1");
    expect(res).toEqual({ ok: true });
    expect(store.renders.get("r1")?.chosenVariantId).toBe("v1");
  });

  it("rifiuta una variante di un altro render", async () => {
    const res = await chooseVariant("r1", "v2");
    expect(res).toEqual({ ok: false, error: "La variante non appartiene a questo render" });
    expect(store.renders.get("r1")?.chosenVariantId).toBeNull();
    expect(store.renders.get("r2")?.chosenVariantId).toBeNull();
  });

  it("rifiuta una variante non DONE (FAILED o PENDING)", async () => {
    for (const id of ["v3", "v4"]) {
      const res = await chooseVariant("r1", id);
      expect(res).toEqual({ ok: false, error: "Si può scegliere solo una variante completata" });
    }
    expect(store.renders.get("r1")?.chosenVariantId).toBeNull();
  });

  it("rifiuta render o variante inesistenti", async () => {
    expect(await chooseVariant("nope", "v1")).toEqual({ ok: false, error: "Render non trovato" });
    expect(await chooseVariant("r1", "nope")).toEqual({ ok: false, error: "Variante non trovata" });
  });

  it("cambia la scelta precedente", async () => {
    store.variants.set("v5", { id: "v5", renderId: "r1", status: "DONE", imageUrl: "/api/files/c.jpg" });
    await chooseVariant("r1", "v1");
    await chooseVariant("r1", "v5");
    expect(store.renders.get("r1")?.chosenVariantId).toBe("v5");
  });
});
