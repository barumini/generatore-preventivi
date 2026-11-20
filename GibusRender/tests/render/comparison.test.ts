import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// --- Finto Prisma in memoria e finto storage ------------------------------------

type AnyRow = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  products: new Map<string, AnyRow>(),
  finishes: new Map<string, AnyRow>(),
  references: new Map<string, AnyRow>(),
  renders: new Map<string, AnyRow>(),
  variants: new Map<string, AnyRow>(),
  comparisons: new Map<string, AnyRow>(),
  enabledProviders: ["openai", "openrouter"],
  seq: 0,
}));

const files = vi.hoisted(() => ({
  data: new Map<string, Buffer>(),
  deleted: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/storage", () => ({
  putFile: async (key: string, data: Buffer) => {
    files.data.set(`/api/files/${key}`, data);
    return `/api/files/${key}`;
  },
  getFile: async (url: string) => {
    const f = files.data.get(url);
    if (!f) throw new Error(`file assente: ${url}`);
    return f;
  },
  deleteFile: async (url: string) => {
    files.deleted.push(url);
    files.data.delete(url);
  },
}));

vi.mock("@/lib/db", () => {
  const nextId = (p: string) => `${p}${++store.seq}`;
  const clone = <T>(v: T): T => structuredClone(v);
  const byId = (m: Map<string, AnyRow>) => async ({ where }: { where: { id: string } }) => {
    const r = m.get(where.id);
    return r ? clone(r) : null;
  };
  return {
    db: {
      product: { findUnique: byId(store.products) },
      finish: { findUnique: byId(store.finishes) },
      referenceImage: {
        count: async ({ where }: { where: { productId: string } }) =>
          [...store.references.values()].filter((r) => r.productId === where.productId).length,
      },
      comparison: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { createdAt: new Date(), ...clone(data), id: nextId("cmp") } as AnyRow;
          store.comparisons.set(row.id, row);
          return clone(row);
        },
        findUnique: byId(store.comparisons),
        delete: async ({ where }: { where: { id: string } }) => {
          const row = store.comparisons.get(where.id);
          if (!row) throw new Error("not found");
          store.comparisons.delete(where.id);
          return clone(row);
        },
        deleteMany: async ({ where }: { where: { id: string } }) => {
          const had = store.comparisons.delete(where.id);
          return { count: had ? 1 : 0 };
        },
      },
      render: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            disclaimer: false,
            chosenVariantId: null,
            comparisonId: null,
            createdAt: new Date(),
            ...clone(data),
            id: (data.id as string) ?? nextId("r"),
          } as AnyRow;
          store.renders.set(row.id, row);
          return clone(row);
        },
        findUnique: async ({ where, include }: { where: { id: string }; include?: { variants?: boolean } }) => {
          const r = store.renders.get(where.id);
          if (!r) return null;
          const out = clone(r) as AnyRow & { variants?: AnyRow[] };
          if (include?.variants) {
            out.variants = [...store.variants.values()].filter((v) => v.renderId === r.id).map(clone);
          }
          return out;
        },
        findMany: async ({ where }: { where: { comparisonId?: string } }) =>
          [...store.renders.values()].filter((r) => r.comparisonId === where.comparisonId).map(clone),
        updateMany: async ({ where, data }: { where: { comparisonId?: string }; data: Record<string, unknown> }) => {
          let count = 0;
          for (const r of store.renders.values()) {
            if (r.comparisonId !== where.comparisonId) continue;
            Object.assign(r, clone(data));
            count++;
          }
          return { count };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const row = store.renders.get(where.id);
          if (!row) throw new Error("not found");
          store.renders.delete(where.id);
          for (const [id, v] of store.variants) if (v.renderId === where.id) store.variants.delete(id);
          return clone(row);
        },
      },
      settings: {
        upsert: async () => ({
          id: 1,
          activeProviderId: "openai",
          activeModel: "gpt-image-2",
          quality: "high",
          enabledProviders: [...store.enabledProviders],
          defaultVariants: 3,
          maxPhotoSide: 3000,
        }),
      },
    },
  };
});

import { createRender, RenderInputError, type CreateRenderInput } from "@/lib/render/generate";
import { createComparison } from "@/lib/render/comparison";
import { POST as postComparison } from "@/app/api/confronti/route";

// --- Dati di prova ------------------------------------------------------------

const W = 1200;
const H = 900;
let photo: Buffer;
const POLYGON = [
  { x: 0.4, y: 0.4 },
  { x: 0.6, y: 0.4 },
  { x: 0.6, y: 0.6 },
  { x: 0.4, y: 0.6 },
];

function baseInput(over: Record<string, unknown> = {}): CreateRenderInput {
  return {
    clientRef: "Rossi 12",
    photo,
    productId: "p1",
    widthMm: 4200,
    depthMm: 3800,
    clearHeightMm: 2400,
    totalHeightMm: 2746,
    polygon: POLYGON,
    positionText: "",
    providerId: "openai",
    model: "gpt-image-2",
    quality: "high",
    variantsRequested: 3,
    disclaimer: false,
    ...over,
  } as CreateRenderInput;
}

const COMBOS = [
  { colorId: "c1", fabricId: "f1" },
  { colorId: "c2", fabricId: "f1" },
  { colorId: "c3", fabricId: null },
];

beforeAll(async () => {
  photo = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 120, g: 140, b: 160 } } })
    .jpeg()
    .toBuffer();
});

beforeEach(() => {
  for (const m of [store.products, store.finishes, store.references, store.renders, store.variants, store.comparisons]) {
    m.clear();
  }
  files.data.clear();
  files.deleted.length = 0;
  store.products.set("p1", {
    id: "p1",
    name: "ZENIT – Addossata frontale",
    mountType: "ADDOSSATA",
    coverType: "TELO",
    aiDescription: "Wall-mounted aluminium pergola.",
  });
  store.finishes.set("c1", { id: "c1", kind: "COLORE", name: "Antracite", code: "RAL 7016" });
  store.finishes.set("c2", { id: "c2", kind: "COLORE", name: "Bianco", code: "RAL 9010" });
  store.finishes.set("c3", { id: "c3", kind: "COLORE", name: "Corten", code: "RAL 8004" });
  store.finishes.set("f1", { id: "f1", kind: "TESSUTO", name: "Ecru", code: "ECR-123" });
});

// --- createComparison -------------------------------------------------------------

describe("createComparison", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  beforeEach(() => errorSpy.mockClear());
  afterEach(() => errorSpy.mockClear());

  it("crea un confronto e un render per combinazione, ognuno con la propria foto", async () => {
    const { id, renderIds } = await createComparison(baseInput(), COMBOS);
    expect(renderIds).toHaveLength(3);
    expect(store.comparisons.get(id)).toMatchObject({ clientRef: "Rossi 12" });
    expect(store.comparisons.size).toBe(1);
    const rows = renderIds.map((rid) => store.renders.get(rid)!);
    for (const [i, row] of rows.entries()) {
      expect(row).toMatchObject({ comparisonId: id, colorId: COMBOS[i].colorId, fabricId: COMBOS[i].fabricId });
    }
    expect(new Set(rows.map((r) => r.photoUrl)).size).toBe(3);
    for (const r of rows) expect(files.data.has(r.photoUrl as string)).toBe(true);
  });

  it("costruisce un testo per ogni finitura e ignora il prompt dell'input", async () => {
    const { renderIds } = await createComparison(baseInput({ prompt: "Testo a mano" }), COMBOS);
    const prompts = renderIds.map((rid) => store.renders.get(rid)!.prompt as string);
    expect(prompts.some((p) => p.includes("Testo a mano"))).toBe(false);
    const codes = ["RAL 7016", "RAL 9010", "RAL 8004"];
    for (const [i, p] of prompts.entries()) {
      expect(p).toContain(codes[i]);
      for (const [j, other] of codes.entries()) if (j !== i) expect(p).not.toContain(other);
    }
  });

  it("il primo render usa la foto caricata, gli altri copiano quella del primo", async () => {
    const { renderIds } = await createComparison(baseInput(), COMBOS);
    const [first, ...others] = renderIds.map((rid) => files.data.get(store.renders.get(rid)!.photoUrl as string)!);
    for (const o of others) expect(o.equals(first)).toBe(true);
    expect((await sharp(first).metadata()).width).toBe(W);
  });

  it("con sourceRenderId e senza foto tutti i render hanno le dimensioni del render di partenza", async () => {
    const src = await createRender(baseInput({ maxPhotoSide: 600, colorId: "c1" }));
    const { renderIds } = await createComparison(baseInput({ photo: undefined, sourceRenderId: src.id }), COMBOS);
    for (const rid of renderIds) {
      expect(store.renders.get(rid)).toMatchObject({ photoWidth: 600, photoHeight: 450 });
    }
  });

  it("tutto o niente: un colore inesistente al secondo render annulla anche il primo", async () => {
    const bad = [COMBOS[0], { colorId: "nessuno", fabricId: null }, COMBOS[2]];
    await expect(createComparison(baseInput(), bad)).rejects.toThrow(new RenderInputError("Colore non trovato"));
    expect(store.renders.size).toBe(0);
    expect(store.comparisons.size).toBe(0);
    expect(files.deleted).toHaveLength(1);
    expect(files.data.size).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("tutto o niente: un errore al terzo render annulla i due già creati, anche sciogliendo il confronto", async () => {
    const bad = [COMBOS[0], COMBOS[1], { colorId: "nessuno", fabricId: null }];
    await expect(createComparison(baseInput(), bad)).rejects.toThrow(new RenderInputError("Colore non trovato"));
    expect(store.renders.size).toBe(0);
    expect(store.variants.size).toBe(0);
    expect(store.comparisons.size).toBe(0);
    expect(files.deleted).toHaveLength(2);
    expect(files.data.size).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("senza combinazioni valide lancia RenderInputError e non scrive nulla", async () => {
    await expect(createComparison(baseInput(), [COMBOS[0]])).rejects.toBeInstanceOf(RenderInputError);
    await expect(createComparison(baseInput(), [COMBOS[0]])).rejects.toThrow(/almeno due finiture/);
    expect(store.renders.size).toBe(0);
    expect(store.comparisons.size).toBe(0);
    expect(files.data.size).toBe(0);
  });
});

// --- Route ----------------------------------------------------------------------

function form(over: Record<string, string | Blob | undefined> = {}) {
  const fields: Record<string, string | Blob | undefined> = {
    clientRef: "Rossi 12",
    photo: new File([new Uint8Array(photo)], "foto.jpg", { type: "image/jpeg" }),
    productId: "p1",
    widthMm: "4200",
    depthMm: "3800",
    clearHeightMm: "2400",
    totalHeightMm: "2746",
    polygon: JSON.stringify(POLYGON),
    positionText: "",
    providerId: "openai",
    model: "gpt-image-2",
    quality: "high",
    variantsRequested: "2",
    disclaimer: "false",
    finishes: JSON.stringify(COMBOS),
    ...over,
  };
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, v);
  return f;
}

const post = (f: FormData) => new Request("http://localhost/api/confronti", { method: "POST", body: f });

describe("POST /api/confronti", () => {
  it("crea il confronto e restituisce l'id", async () => {
    const res = await postComparison(post(form()));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    expect(store.comparisons.has(id)).toBe(true);
    expect(store.renders.size).toBe(3);
  });

  it.each([
    ["mancante", undefined],
    ["non JSON", "{non json"],
    ["di forma sbagliata", JSON.stringify([{ colorId: 5 }])],
  ])("finishes %s → 400", async (_n, finishes) => {
    const res = await postComparison(post(form({ finishes })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Finiture del confronto non valide" });
    expect(store.renders.size).toBe(0);
  });

  it("finiture ripetute → 400 con il messaggio di checkCombos", async () => {
    const res = await postComparison(post(form({ finishes: JSON.stringify([COMBOS[0], COMBOS[0]]) })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Finiture ripetute nel confronto" });
  });

  it("fornitore non abilitato → 400", async () => {
    store.enabledProviders = ["openrouter"];
    try {
      const res = await postComparison(post(form()));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Fornitore non abilitato nelle impostazioni" });
      expect(store.renders.size).toBe(0);
      expect(store.comparisons.size).toBe(0);
    } finally {
      store.enabledProviders = ["openai", "openrouter"];
    }
  });

  it("senza riferimento del cliente → 400 e nessun confronto scritto", async () => {
    const res = await postComparison(post(form({ clientRef: undefined })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Indica il riferimento del cliente" });
    expect(store.comparisons.size).toBe(0);
    expect(store.renders.size).toBe(0);
  });
});
