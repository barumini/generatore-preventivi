import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Finto Prisma in memoria -------------------------------------------------

type Row = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  renders: new Map<string, Row>(),
  variants: new Map<string, Row>(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const files = vi.hoisted(() => ({ deleted: [] as string[], failOn: new Set<string>() }));
vi.mock("@/lib/storage", () => ({
  deleteFile: async (url: string) => {
    if (files.failOn.has(url)) throw new Error("disco in sola lettura");
    files.deleted.push(url);
  },
}));

vi.mock("@/lib/db", () => {
  const clone = <T>(v: T): T => structuredClone(v);
  const model = (map: Map<string, Row>) => ({
    findUnique: async ({ where, include }: { where: { id: string }; include?: { variants?: boolean } }) => {
      const r = map.get(where.id);
      if (!r) return null;
      const out = clone(r) as Row & { variants?: Row[] };
      if (include?.variants) out.variants = [...store.variants.values()].filter((v) => v.renderId === r.id).map(clone);
      return out;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const row = map.get(where.id);
      if (!row) throw new Error("not found");
      map.delete(where.id);
      // onDelete: Cascade da Render a Variant
      if (map === store.renders) for (const [id, v] of store.variants) if (v.renderId === where.id) store.variants.delete(id);
      return clone(row);
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

import { chooseVariant, deleteRender, deleteVariant } from "@/lib/render/actions";

beforeEach(() => {
  files.deleted.length = 0;
  files.failOn.clear();
  store.renders.clear();
  store.variants.clear();
  store.renders.set("r1", { id: "r1", clientRef: "Rossi", chosenVariantId: null, photoUrl: "/api/files/renders/r1/photo.jpg" });
  store.renders.set("r2", { id: "r2", clientRef: "Bianchi", chosenVariantId: null, photoUrl: "/api/files/renders/r2/photo.jpg" });
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

describe("deleteVariant", () => {
  it("elimina la variante e il suo file, senza toccare le altre", async () => {
    expect(await deleteVariant("v1")).toEqual({ ok: true });
    expect(store.variants.has("v1")).toBe(false);
    expect(files.deleted).toEqual(["/api/files/a.jpg"]);
    expect(store.variants.has("v2")).toBe(true);
    expect(store.renders.has("r1")).toBe(true);
  });

  it("se era la variante scelta, il render non ne ha più una scelta", async () => {
    store.renders.set("r1", { ...store.renders.get("r1")!, chosenVariantId: "v1" });
    await deleteVariant("v1");
    expect(store.renders.get("r1")?.chosenVariantId).toBeNull();
  });

  it("una variante fallita (senza immagine) si elimina senza cercare file", async () => {
    expect(await deleteVariant("v3")).toEqual({ ok: true });
    expect(files.deleted).toEqual([]);
  });

  it("se il file non si riesce a cancellare la variante è comunque eliminata", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    files.failOn.add("/api/files/a.jpg");
    expect(await deleteVariant("v1")).toEqual({ ok: true });
    expect(store.variants.has("v1")).toBe(false);
    spy.mockRestore();
  });

  it("rifiuta variante inesistente o id non valido", async () => {
    expect(await deleteVariant("nope")).toEqual({ ok: false, error: "Variante non trovata" });
    expect(await deleteVariant(undefined as unknown as string)).toEqual({ ok: false, error: "Dati non validi" });
  });
});

describe("deleteRender", () => {
  it("elimina render, varianti, foto e immagini, senza toccare gli altri render", async () => {
    expect(await deleteRender("r1")).toEqual({ ok: true });
    expect(store.renders.has("r1")).toBe(false);
    for (const id of ["v1", "v3", "v4"]) expect(store.variants.has(id)).toBe(false);
    expect([...files.deleted].sort()).toEqual(["/api/files/a.jpg", "/api/files/renders/r1/photo.jpg"]);
    expect(store.renders.has("r2")).toBe(true);
    expect(store.variants.has("v2")).toBe(true);
  });

  it("anche se qualche file non si cancella il render è eliminato", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    files.failOn.add("/api/files/renders/r1/photo.jpg");
    expect(await deleteRender("r1")).toEqual({ ok: true });
    expect(store.renders.has("r1")).toBe(false);
    expect(files.deleted).toContain("/api/files/a.jpg");
    spy.mockRestore();
  });

  it("rifiuta render inesistente o id non valido", async () => {
    expect(await deleteRender("nope")).toEqual({ ok: false, error: "Render non trovato" });
    expect(await deleteRender(42 as unknown as string)).toEqual({ ok: false, error: "Dati non validi" });
  });
});
