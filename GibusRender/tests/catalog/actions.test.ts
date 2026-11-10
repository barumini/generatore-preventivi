import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// --- Finto Prisma in memoria -------------------------------------------------

type Row = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  products: new Map<string, Row>(),
  finishes: new Map<string, Row>(),
  productFinishes: [] as { productId: string; finishId: string }[],
  references: new Map<string, Row>(),
  renders: new Map<string, Row>(),
  seq: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  putFile: vi.fn(async (key: string) => `/api/files/${key}`),
}));

vi.mock("@/lib/db", () => {
  const clone = <T>(v: T): T => structuredClone(v);
  const uniq = (m: Map<string, Row>, field: string, row: Row, selfId?: string) => {
    for (const r of m.values()) {
      if (r.id !== selfId && r[field] === row[field]) {
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }
    }
  };
  const matches = (row: Row, where: Record<string, unknown> | undefined): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      if (k === "OR") return (v as Record<string, unknown>[]).some((w) => matches(row, w));
      if (v && typeof v === "object" && "in" in (v as object)) {
        return ((v as { in: unknown[] }).in).includes(row[k]);
      }
      return row[k] === v;
    });
  };
  const pick = (row: Row, select?: Record<string, boolean>) => {
    if (!select) return clone(row);
    return Object.fromEntries(Object.keys(select).map((k) => [k, clone(row[k])]));
  };
  const m = (map: Map<string, Row>, prefix: string, defaults: Record<string, unknown> = {}, uniqueField?: string) => ({
    findUnique: async ({ where }: { where: { id: string } }) => {
      const r = map.get(where.id);
      return r ? clone(r) : null;
    },
    findMany: async ({ where, select }: { where?: Record<string, unknown>; select?: Record<string, boolean> } = {}) =>
      [...map.values()].filter((r) => matches(r, where)).map((r) => pick(r, select)),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { ...defaults, ...clone(data), id: `${prefix}${++store.seq}` } as Row;
      if (uniqueField) uniq(map, uniqueField, row);
      map.set(row.id, row);
      return clone(row);
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = map.get(where.id);
      if (!row) throw new Error("not found");
      const next = { ...row, ...clone(data) } as Row;
      if (uniqueField) uniq(map, uniqueField, next, row.id);
      map.set(row.id, next);
      return clone(next);
    },
  });

  return {
    db: {
      product: {
        ...m(store.products, "p", {}, "name"),
        delete: async ({ where }: { where: { id: string } }) => {
          store.products.delete(where.id);
          // Come il database: riferimenti e finiture a cascata, render a SetNull.
          for (const [id, r] of store.references) if (r.productId === where.id) store.references.delete(id);
          store.productFinishes = store.productFinishes.filter((pf) => pf.productId !== where.id);
          for (const r of store.renders.values()) if (r.productId === where.id) r.productId = null;
        },
      },
      finish: {
        ...m(store.finishes, "f", {}, "code"),
        delete: async ({ where }: { where: { id: string } }) => {
          store.finishes.delete(where.id);
          store.productFinishes = store.productFinishes.filter((pf) => pf.finishId !== where.id);
          for (const r of store.renders.values()) {
            if (r.colorId === where.id) r.colorId = null;
            if (r.fabricId === where.id) r.fabricId = null;
          }
        },
      },
      productFinish: {
        deleteMany: async ({ where }: { where: { productId: string } }) => {
          store.productFinishes = store.productFinishes.filter((pf) => pf.productId !== where.productId);
        },
        createMany: async ({ data }: { data: { productId: string; finishId: string }[] }) => {
          store.productFinishes.push(...data);
        },
      },
      referenceImage: {
        ...m(store.references, "ref"),
        findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
          [...store.references.values()]
            .filter((r) => matches(r, where))
            .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
            .map(clone),
        delete: async ({ where }: { where: { id: string } }) => {
          store.references.delete(where.id);
        },
      },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    },
  };
});

import {
  addReferenceImage,
  deleteFinish,
  deleteProduct,
  moveReferenceImage,
  removeReferenceImage,
  saveFinish,
  saveProduct,
} from "@/lib/catalog/actions";
import { putFile } from "@/lib/storage";

// --- Aiuti -------------------------------------------------------------------

const LONG = "Pergola in alluminio con copertura a lamelle orientabili e quattro montanti quadrati d'angolo.";

function productForm(over: Record<string, string | string[]> = {}): FormData {
  const base: Record<string, string | string[]> = {
    name: "Prova",
    mountType: "AUTOPORTANTE",
    coverType: "LAMELLE_ORIENTABILI",
    aiDescription: LONG,
    widthMm: "3000",
    depthMm: "3000",
    clearHeightMm: "2400",
    totalHeightMm: "2600",
    defaultColorId: "",
    defaultFabricId: "",
    finishIds: [],
    ...over,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(base)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

function finishForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ kind: "COLORE", name: "Bianco", code: "RAL 9010", swatchHex: "#FFFFFF", ...over })) {
    fd.set(k, v);
  }
  return fd;
}

function seedFinish(id: string, kind: "COLORE" | "TESSUTO", code = id): void {
  store.finishes.set(id, { id, kind, name: `Finitura ${code}`, code, swatchHex: null });
}

function seedProduct(id: string, over: Record<string, unknown> = {}): void {
  store.products.set(id, {
    id,
    name: `Prodotto ${id}`,
    mountType: "AUTOPORTANTE",
    coverType: "TELO",
    aiDescription: LONG,
    widthMm: 3000,
    depthMm: 3000,
    clearHeightMm: 2400,
    totalHeightMm: 2600,
    defaultColorId: null,
    defaultFabricId: null,
    ...over,
  });
}

let png: Buffer;
beforeAll(async () => {
  png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#808080" } }).png().toBuffer();
});

beforeEach(() => {
  store.products.clear();
  store.finishes.clear();
  store.productFinishes = [];
  store.references.clear();
  store.renders.clear();
  store.seq = 0;
  vi.mocked(putFile).mockClear();
});

// --- saveProduct -------------------------------------------------------------

describe("saveProduct", () => {
  it("crea un prodotto valido con le finiture e i predefiniti", async () => {
    seedFinish("c1", "COLORE");
    seedFinish("t1", "TESSUTO");
    const res = await saveProduct(
      productForm({ finishIds: ["c1", "t1"], defaultColorId: "c1", defaultFabricId: "t1" }),
    );
    expect(res.ok).toBe(true);
    const id = (res as { id: string }).id;
    expect(store.products.get(id)).toMatchObject({ name: "Prova", widthMm: 3000, defaultColorId: "c1", defaultFabricId: "t1" });
    expect(store.productFinishes.map((p) => p.finishId).sort()).toEqual(["c1", "t1"]);
  });

  it("aggiorna un prodotto esistente (id nel modulo) e sostituisce le finiture", async () => {
    seedFinish("c1", "COLORE");
    seedFinish("c2", "COLORE");
    seedProduct("p9", { name: "Lamella Compact" });
    store.productFinishes.push({ productId: "p9", finishId: "c1" });
    const res = await saveProduct(productForm({ id: "p9", name: "Prova", finishIds: ["c2"] }));
    expect(res).toEqual({ ok: true, id: "p9" });
    expect(store.products.get("p9")?.name).toBe("Prova");
    expect(store.productFinishes).toEqual([{ productId: "p9", finishId: "c2" }]);
  });

  it("il nome è obbligatorio", async () => {
    const res = await saveProduct(productForm({ name: "   " }));
    expect(res).toEqual({ ok: false, error: expect.stringContaining("nome") });
    expect(store.products.size).toBe(0);
  });

  it.each(["499", "15001", "3000.5", "abc", ""])("rifiuta una misura non valida (%s)", async (bad) => {
    const res = await saveProduct(productForm({ widthMm: bad }));
    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toContain("500");
    expect(store.products.size).toBe(0);
  });

  it("accetta i limiti 500 e 15000", async () => {
    expect((await saveProduct(productForm({ widthMm: "500", depthMm: "15000" }))).ok).toBe(true);
  });

  it("la descrizione per l'IA richiede almeno 50 caratteri", async () => {
    const res = await saveProduct(productForm({ aiDescription: "troppo corta" }));
    expect(res).toEqual({ ok: false, error: expect.stringContaining("50") });
  });

  it("rifiuta un nome già usato da un altro prodotto", async () => {
    seedProduct("p1", { name: "Prova" });
    const res = await saveProduct(productForm());
    expect(res).toEqual({ ok: false, error: expect.stringContaining("Esiste già") });
  });

  it("il colore predefinito deve essere un colore tra le finiture scelte", async () => {
    seedFinish("c1", "COLORE");
    seedFinish("t1", "TESSUTO");
    const notSelected = await saveProduct(productForm({ finishIds: [], defaultColorId: "c1" }));
    expect(notSelected.ok).toBe(false);
    const wrongKind = await saveProduct(productForm({ finishIds: ["t1"], defaultColorId: "t1" }));
    expect(wrongKind.ok).toBe(false);
    expect(store.products.size).toBe(0);
  });

  it("rifiuta finiture inesistenti", async () => {
    const res = await saveProduct(productForm({ finishIds: ["nope"] }));
    expect(res.ok).toBe(false);
  });
});

// --- deleteProduct -----------------------------------------------------------

describe("deleteProduct", () => {
  it("elimina un prodotto anche con render collegati, che conservano nome e misure", async () => {
    seedProduct("p1", { name: "Lamella Compact" });
    store.references.set("ref1", { id: "ref1", productId: "p1", url: "x", label: "a", sortOrder: 0 });
    store.renders.set("r1", {
      id: "r1",
      productId: "p1",
      productName: "Lamella Compact",
      widthMm: 3000,
      depthMm: 3080,
    });
    expect(await deleteProduct("p1")).toEqual({ ok: true });
    expect(store.products.has("p1")).toBe(false);
    expect(store.references.size).toBe(0);
    expect(store.renders.get("r1")).toMatchObject({
      productId: null,
      productName: "Lamella Compact",
      widthMm: 3000,
      depthMm: 3080,
    });
  });
});

// --- saveFinish / deleteFinish -----------------------------------------------

describe("saveFinish", () => {
  it("crea e aggiorna una finitura", async () => {
    const created = await saveFinish(finishForm());
    expect(created.ok).toBe(true);
    const id = (created as { id: string }).id;
    expect(store.finishes.get(id)).toMatchObject({ kind: "COLORE", name: "Bianco", code: "RAL 9010", swatchHex: "#FFFFFF" });
    const updated = await saveFinish(finishForm({ id, name: "Bianco puro", swatchHex: "" }));
    expect(updated).toEqual({ ok: true, id });
    expect(store.finishes.get(id)).toMatchObject({ name: "Bianco puro", swatchHex: null });
  });

  it("valida nome, codice, tipo e colore", async () => {
    expect((await saveFinish(finishForm({ name: " " }))).ok).toBe(false);
    expect((await saveFinish(finishForm({ code: "" }))).ok).toBe(false);
    expect((await saveFinish(finishForm({ kind: "ALTRO" }))).ok).toBe(false);
    expect((await saveFinish(finishForm({ swatchHex: "rosso" }))).ok).toBe(false);
    expect(store.finishes.size).toBe(0);
  });

  it("rifiuta un codice già usato", async () => {
    seedFinish("f1", "COLORE", "RAL 9010");
    const res = await saveFinish(finishForm());
    expect(res).toEqual({ ok: false, error: expect.stringContaining("codice") });
  });
});

describe("deleteFinish", () => {
  it("rifiuta una finitura usata come predefinita, elencando i prodotti", async () => {
    seedFinish("c1", "COLORE");
    seedFinish("t1", "TESSUTO");
    seedProduct("p1", { name: "Alfa", defaultColorId: "c1" });
    seedProduct("p2", { name: "Beta", defaultColorId: "c1" });
    seedProduct("p3", { name: "Gamma", defaultFabricId: "t1" });
    const res = await deleteFinish("c1");
    expect(res).toEqual({ ok: false, error: "Finitura in uso come predefinita in: Alfa, Beta" });
    expect(store.finishes.has("c1")).toBe(true);
    const res2 = await deleteFinish("t1");
    expect(res2).toEqual({ ok: false, error: "Finitura in uso come predefinita in: Gamma" });
  });

  it("elimina una finitura non predefinita, scollegandola dai prodotti e dai render", async () => {
    seedFinish("c1", "COLORE");
    seedProduct("p1");
    store.productFinishes.push({ productId: "p1", finishId: "c1" });
    store.renders.set("r1", { id: "r1", colorId: "c1", fabricId: null });
    expect(await deleteFinish("c1")).toEqual({ ok: true });
    expect(store.finishes.has("c1")).toBe(false);
    expect(store.productFinishes).toEqual([]);
    expect(store.renders.get("r1")?.colorId).toBeNull();
  });
});

// --- Immagini di riferimento ---------------------------------------------------

describe("addReferenceImage", () => {
  it("normalizza (ruota, max 2000 px sul lato lungo, PNG) e salva", async () => {
    seedProduct("p1");
    const file = new File([new Uint8Array(png)], "foto.png", { type: "image/png" });
    const res = await addReferenceImage("p1", file, "Vista laterale");
    expect(res.ok).toBe(true);
    const [key, data, type] = vi.mocked(putFile).mock.calls[0];
    expect(key).toMatch(/^references\/p1\/[\w-]+\.png$/);
    expect(type).toBe("image/png");
    const meta = await sharp(data).metadata();
    expect(meta.format).toBe("png");
    expect(Math.max(meta.width!, meta.height!)).toBe(2000);
    const [ref] = [...store.references.values()];
    expect(ref).toMatchObject({ productId: "p1", label: "Vista laterale", sortOrder: 0, url: `/api/files/${key}` });
  });

  it("mette le nuove immagini in coda e usa un'etichetta predefinita", async () => {
    seedProduct("p1");
    store.references.set("a", { id: "a", productId: "p1", url: "u", label: "x", sortOrder: 4 });
    const file = new File([new Uint8Array(png)], "foto.png", { type: "image/png" });
    await addReferenceImage("p1", file);
    const added = [...store.references.values()].find((r) => r.id !== "a")!;
    expect(added.sortOrder).toBe(5);
    expect(added.label).toBe("Riferimento");
  });

  it("rifiuta file che non sono immagini", async () => {
    seedProduct("p1");
    const file = new File(["non sono un'immagine"], "a.png", { type: "image/png" });
    const res = await addReferenceImage("p1", file);
    expect(res).toEqual({ ok: false, error: expect.stringContaining("immagine") });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("rifiuta file oltre 4 MB", async () => {
    seedProduct("p1");
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" });
    const res = await addReferenceImage("p1", big);
    expect(res).toEqual({ ok: false, error: expect.stringContaining("4 MB") });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("rifiuta un prodotto inesistente o l'assenza di file", async () => {
    expect((await addReferenceImage("nope", new File([new Uint8Array(png)], "a.png"))).ok).toBe(false);
    seedProduct("p1");
    expect((await addReferenceImage("p1", null as unknown as File)).ok).toBe(false);
  });
});

describe("removeReferenceImage / moveReferenceImage", () => {
  beforeEach(() => {
    seedProduct("p1");
    for (const [i, id] of ["a", "b", "c"].entries()) {
      store.references.set(id, { id, productId: "p1", url: id, label: id, sortOrder: i });
    }
  });
  const order = () =>
    [...store.references.values()].sort((x, y) => (x.sortOrder as number) - (y.sortOrder as number)).map((r) => r.id);

  it("elimina un riferimento", async () => {
    expect(await removeReferenceImage("b")).toEqual({ ok: true });
    expect(order()).toEqual(["a", "c"]);
  });

  it("sposta su e giù, fermandosi ai bordi", async () => {
    await moveReferenceImage("c", "up");
    expect(order()).toEqual(["a", "c", "b"]);
    await moveReferenceImage("a", "down");
    expect(order()).toEqual(["c", "a", "b"]);
    await moveReferenceImage("c", "up");
    expect(order()).toEqual(["c", "a", "b"]);
    await moveReferenceImage("b", "down");
    expect(order()).toEqual(["c", "a", "b"]);
  });
});
