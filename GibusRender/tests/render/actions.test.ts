import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Finto Prisma in memoria -------------------------------------------------

type Row = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  renders: new Map<string, Row>(),
  variants: new Map<string, Row>(),
  comparisons: new Map<string, Row>(),
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
  const matches = (r: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) =>
      v && typeof v === "object" && "not" in v ? r[k] !== (v as { not: unknown }).not : r[k] === v,
    );
  const render = {
    ...model(store.renders),
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      [...store.renders.values()].filter((r) => matches(r, where)).map(clone),
    count: async ({ where }: { where: Record<string, unknown> }) =>
      [...store.renders.values()].filter((r) => matches(r, where)).length,
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      let count = 0;
      for (const r of [...store.renders.values()]) {
        if (!matches(r, where)) continue;
        store.renders.delete(r.id);
        for (const [id, v] of store.variants) if (v.renderId === r.id) store.variants.delete(id);
        count++;
      }
      return { count };
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      let count = 0;
      for (const r of store.renders.values()) {
        if (!matches(r, where)) continue;
        Object.assign(r, clone(data));
        count++;
      }
      return { count };
    },
  };
  const comparison = {
    findUnique: async ({ where, include }: { where: { id: string }; include?: { renders?: unknown } }) => {
      const c = store.comparisons.get(where.id);
      if (!c) return null;
      const out = clone(c) as Row & { renders?: Row[] };
      if (include?.renders) {
        out.renders = [...store.renders.values()]
          .filter((r) => r.comparisonId === c.id)
          .map((r) => ({ ...clone(r), variants: [...store.variants.values()].filter((v) => v.renderId === r.id).map(clone) }));
      }
      return out;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const row = store.comparisons.get(where.id);
      if (!row) throw new Error("not found");
      store.comparisons.delete(where.id);
      // onDelete: SetNull da Comparison a Render
      for (const r of store.renders.values()) if (r.comparisonId === where.id) r.comparisonId = null;
      return clone(row);
    },
    deleteMany: async ({ where }: { where: { id: string } }) => ({ count: store.comparisons.delete(where.id) ? 1 : 0 }),
  };
  // $transaction su array di promesse: le operazioni sono già avviate, qui si attende l'esito
  const $transaction = async (ops: Promise<unknown>[]) => Promise.all(ops);
  return { db: { render, variant: model(store.variants), comparison, $transaction } };
});

import { chooseVariant, deleteComparison, deleteRender, deleteVariant } from "@/lib/render/actions";

beforeEach(() => {
  files.deleted.length = 0;
  files.failOn.clear();
  store.renders.clear();
  store.variants.clear();
  store.comparisons.clear();
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

describe("scelta esclusiva nel confronto", () => {
  beforeEach(() => {
    store.comparisons.set("c1", { id: "c1", clientRef: "Rossi" });
    store.renders.set("r1", { ...store.renders.get("r1")!, comparisonId: "c1", chosenVariantId: "v1" });
    store.renders.set("r2", { ...store.renders.get("r2")!, comparisonId: "c1" });
  });

  it("scegliere in un render azzera la scelta degli altri del confronto", async () => {
    expect(await chooseVariant("r2", "v2")).toEqual({ ok: true });
    expect(store.renders.get("r2")?.chosenVariantId).toBe("v2");
    expect(store.renders.get("r1")?.chosenVariantId).toBeNull();
  });

  it("un render senza confronto non tocca gli altri render", async () => {
    store.renders.set("r9", { id: "r9", clientRef: "X", chosenVariantId: "v1", comparisonId: null, photoUrl: "/p" });
    store.variants.set("v9", { id: "v9", renderId: "r9", status: "DONE", imageUrl: "/api/files/z.jpg" });
    await chooseVariant("r9", "v9");
    expect(store.renders.get("r9")?.chosenVariantId).toBe("v9");
    expect(store.renders.get("r1")?.chosenVariantId).toBe("v1");
  });
});

describe("deleteRender in un confronto", () => {
  beforeEach(() => {
    store.comparisons.set("c1", { id: "c1", clientRef: "Rossi" });
    for (const id of ["r1", "r2"]) store.renders.set(id, { ...store.renders.get(id)!, comparisonId: "c1" });
    store.renders.set("r3", { id: "r3", clientRef: "Rossi", chosenVariantId: null, comparisonId: "c1", photoUrl: "/api/files/renders/r3/photo.jpg" });
  });

  it("il confronto resta con 2 render, poi si scioglie con 1", async () => {
    await deleteRender("r1");
    expect(store.comparisons.has("c1")).toBe(true);
    expect(store.renders.get("r2")?.comparisonId).toBe("c1");
    await deleteRender("r2");
    expect(store.comparisons.has("c1")).toBe(false);
    expect(store.renders.get("r3")?.comparisonId).toBeNull();
  });
});

describe("deleteComparison", () => {
  beforeEach(() => {
    store.comparisons.set("c1", { id: "c1", clientRef: "Rossi" });
    for (const id of ["r1", "r2"]) store.renders.set(id, { ...store.renders.get(id)!, comparisonId: "c1" });
  });

  it("elimina render, varianti, confronto e tutti i file", async () => {
    expect(await deleteComparison("c1")).toEqual({ ok: true });
    expect(store.renders.size).toBe(0);
    expect(store.variants.size).toBe(0);
    expect(store.comparisons.size).toBe(0);
    expect([...files.deleted].sort()).toEqual([
      "/api/files/a.jpg",
      "/api/files/b.jpg",
      "/api/files/renders/r1/photo.jpg",
      "/api/files/renders/r2/photo.jpg",
    ]);
  });

  it("un file che non si cancella non blocca", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    files.failOn.add("/api/files/a.jpg");
    expect(await deleteComparison("c1")).toEqual({ ok: true });
    expect(store.comparisons.size).toBe(0);
    spy.mockRestore();
  });

  it("rifiuta confronto inesistente o id non valido", async () => {
    expect(await deleteComparison("inesistente")).toEqual({ ok: false, error: "Confronto non trovato" });
    expect(await deleteComparison(7 as unknown as string)).toEqual({ ok: false, error: "Dati non validi" });
  });
});
