import fs from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DRIFT_ALTERED_THRESHOLD } from "@/lib/render/scene-check";
import type { GenerateInput, ImageProvider } from "@/lib/providers/types";
import { ProviderError } from "@/lib/providers/types";

// --- Finto Prisma in memoria -------------------------------------------------

type AnyRow = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  products: new Map<string, AnyRow>(),
  finishes: new Map<string, AnyRow>(),
  references: new Map<string, AnyRow>(),
  renders: new Map<string, AnyRow>(),
  variants: new Map<string, AnyRow>(),
  enabledProviders: ["openai", "openrouter"],
  maxPhotoSide: 3000,
  seq: 0,
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
        findMany: async ({ where }: { where: { productId: string } }) =>
          [...store.references.values()]
            .filter((r) => r.productId === where.productId)
            .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
            .map(clone),
        count: async ({ where }: { where: { productId: string } }) =>
          [...store.references.values()].filter((r) => r.productId === where.productId).length,
      },
      render: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            disclaimer: false,
            chosenVariantId: null,
            createdAt: new Date(),
            ...clone(data),
            id: (data.id as string) ?? nextId("r"),
          } as AnyRow;
          store.renders.set(row.id, row);
          return clone(row);
        },
        findUnique: byId(store.renders),
      },
      variant: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            status: "PENDING",
            imageUrl: null,
            error: null,
            createdAt: new Date(),
            ...clone(data),
            id: nextId("v"),
          } as AnyRow;
          store.variants.set(row.id, row);
          return clone(row);
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = store.variants.get(where.id);
          if (!row) throw new Error("not found");
          Object.assign(row, clone(data));
          return clone(row);
        },
        findUnique: async ({ where, include }: { where: { id: string }; include?: { render?: boolean } }) => {
          const row = store.variants.get(where.id);
          if (!row) return null;
          const out = clone(row) as AnyRow;
          if (include?.render) out.render = clone(store.renders.get(row.renderId as string) ?? null);
          return out;
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
          maxPhotoSide: store.maxPhotoSide,
        }),
      },
    },
  };
});

import { createRender, generateVariant, isStale, type CreateRenderInput } from "@/lib/render/generate";
import { db } from "@/lib/db";
import { getRenderDraft } from "@/lib/render/draft";
import { putFile, getFile } from "@/lib/storage";
import { POST as postRender } from "@/app/api/renders/route";
import { POST as postVariant } from "@/app/api/renders/[id]/variants/route";
import { GET as downloadVariant } from "@/app/api/variants/[id]/download/route";

// --- Dati di prova ------------------------------------------------------------

const W = 1200;
const H = 900;
let photo: Buffer;
let redPng: Buffer;
let refPng: Buffer;
const POLYGON = [
  { x: 0.4, y: 0.4 },
  { x: 0.6, y: 0.4 },
  { x: 0.6, y: 0.6 },
  { x: 0.4, y: 0.6 },
];

/** Gradiente morbido con un po' di rumore deterministico. */
async function syntheticPhoto(): Promise<Buffer> {
  const raw = Buffer.alloc(W * H * 3);
  let s = 12345;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const n = (s % 9) - 4;
      const o = (y * W + x) * 3;
      raw[o] = Math.max(0, Math.min(255, Math.round((x / W) * 200) + 20 + n));
      raw[o + 1] = Math.max(0, Math.min(255, Math.round((y / H) * 180) + 40 + n));
      raw[o + 2] = Math.max(0, Math.min(255, 150 + n));
    }
  }
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

function fakeProvider(opts: { supportsMask?: boolean; fail?: ProviderError } = {}) {
  const calls: GenerateInput[] = [];
  const provider: ImageProvider = {
    id: "openai",
    label: "Finto",
    supportsMask: opts.supportsMask ?? true,
    supportedSizes: [
      { width: 1024, height: 1024 },
      { width: 1536, height: 1024 },
      { width: 1024, height: 1536 },
    ],
    suggestedModels: ["finto"],
    isConfigured: () => true,
    generate: async (input) => {
      calls.push(input);
      if (opts.fail) throw opts.fail;
      return redPng;
    },
  };
  return { provider, calls };
}

function baseInput(over: Record<string, unknown> = {}): CreateRenderInput {
  return {
    clientRef: "Rossi 12",
    photo,
    productId: "p1",
    widthMm: 4200,
    depthMm: 3800,
    clearHeightMm: 2400,
    totalHeightMm: 2746,
    colorId: "c1",
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

const createdRenders = new Set<string>();

async function rgb(img: Buffer) {
  return sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** Differenza media per canale fuori dal riquadro 0.3..0.7 (lontano dalla sagoma). */
function meanDiffOutside(a: Buffer, b: Buffer): number {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x > 0.3 * W && x < 0.7 * W && y > 0.3 * H && y < 0.7 * H) continue;
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) sum += Math.abs(a[o + c] - b[o + c]);
      n += 3;
    }
  }
  return sum / n;
}

beforeAll(async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  photo = await syntheticPhoto();
  redPng = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .png()
    .toBuffer();
  refPng = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .png()
    .toBuffer();
});

beforeEach(async () => {
  for (const m of [store.products, store.finishes, store.references, store.renders, store.variants]) m.clear();
  store.products.set("p1", {
    id: "p1",
    name: "ZENIT – Addossata frontale",
    mountType: "ADDOSSATA",
    coverType: "TELO",
    aiDescription: "Wall-mounted aluminium pergola.",
    widthMm: 4200,
    depthMm: 3800,
    clearHeightMm: 2400,
    totalHeightMm: 2746,
  });
  store.finishes.set("c1", { id: "c1", kind: "COLORE", name: "Antracite RAL 7016 sablé", code: "RAL 7016" });
  const refUrl = await putFile("test-generate/ref-1.png", refPng, "image/png");
  store.references.set("ref2", { id: "ref2", productId: "p1", url: refUrl, label: "B", sortOrder: 2 });
  store.references.set("ref1", { id: "ref1", productId: "p1", url: refUrl, label: "A", sortOrder: 1 });
});

afterAll(async () => {
  await fs.rm(".data/test-generate", { recursive: true, force: true });
  for (const id of createdRenders) await fs.rm(`.data/renders/${id}`, { recursive: true, force: true });
});

async function newRender(over: Record<string, unknown> = {}) {
  const r = await createRender(baseInput(over));
  createdRenders.add(r.id);
  return r;
}

// --- createRender ---------------------------------------------------------------

describe("createRender", () => {
  it("salva la foto normalizzata, il nome del prodotto e il prompt costruito", async () => {
    const r = await newRender({
      scaleLine: { a: { x: 0.1, y: 0.5 }, b: { x: 0.35, y: 0.5 }, lengthMm: 900 },
    });
    expect(r.photoUrl).toBe(`/api/files/renders/${r.id}/photo.jpg`);
    expect(r.photoWidth).toBe(W);
    expect(r.photoHeight).toBe(H);
    expect(r.productName).toBe("ZENIT – Addossata frontale");
    expect(r.prompt).toContain("inside the masked area");
    expect(r.prompt).toContain("RAL 7016");
    expect(r.prompt).toContain("2 reference images");
    expect(r.prompt).toContain("spans about 300 px of the 1200 px photo width");
    const meta = await sharp(await getFile(r.photoUrl)).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: W, height: H });
  });

  it("con OpenRouter (maschera non applicata) il prompt chiede di usare l'area bianca della maschera", async () => {
    const r = await newRender({ providerId: "openrouter", model: "google/gemini-2.5-flash-image" });
    expect(r.prompt).toContain("The pergola must be placed exactly inside the white area of the mask image provided");
    expect(r.prompt).not.toContain("inside the masked area");
    const noPolygon = await newRender({
      providerId: "openrouter",
      model: "google/gemini-2.5-flash-image",
      polygon: undefined,
      positionText: "a destra",
    });
    expect(noPolygon.prompt).not.toContain("mask image");
  });

  it("createRender riduce la foto al maxPhotoSide richiesto (predefinito 3000)", async () => {
    const small = await createRender(baseInput({ maxPhotoSide: 600 }));
    createdRenders.add(small.id);
    expect(small).toMatchObject({ photoWidth: 600, photoHeight: 450 });
    const full = await createRender(baseInput());
    createdRenders.add(full.id);
    expect(full).toMatchObject({ photoWidth: W, photoHeight: H });
  });

  it("usa il prompt fornito così com'è", async () => {
    const r = await newRender({ prompt: "Prompt modificato a mano" });
    expect(r.prompt).toBe("Prompt modificato a mano");
  });

  it("normalizza gli a capo CRLF del multipart in LF (prompt e posizione)", async () => {
    const r = await newRender({ prompt: "Riga 1\r\n\r\nRiga 2\rRiga 3", positionText: "a destra\r\nsul patio" });
    expect(r.prompt).toBe("Riga 1\n\nRiga 2\nRiga 3");
    expect(r.positionText).toBe("a destra\nsul patio");
  });

  it("senza poligono e con positionText vuoto → errore di validazione", async () => {
    await expect(createRender(baseInput({ polygon: undefined, positionText: "  " }))).rejects.toThrow(
      "Indica la posizione: disegna la sagoma o descrivila a parole",
    );
  });

  it("rifiuta misure fuori intervallo e prodotti inesistenti", async () => {
    await expect(createRender(baseInput({ widthMm: 400 }))).rejects.toThrow(/500/);
    await expect(createRender(baseInput({ productId: "nessuno" }))).rejects.toThrow("Prodotto non trovato");
  });

  it("rifiuta una sagoma non valida con il messaggio di validatePolygon", async () => {
    await expect(createRender(baseInput({ polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }))).rejects.toThrow(
      "La sagoma deve avere almeno 3 punti",
    );
  });
});

describe("createRender da un render esistente (sourceRenderId)", () => {
  it("riusa la foto normalizzata del render di partenza copiandola, senza rinormalizzarla", async () => {
    const src = await newRender();
    const r = await newRender({ photo: undefined, sourceRenderId: src.id });
    expect(r.id).not.toBe(src.id);
    expect(r.photoUrl).toBe(`/api/files/renders/${r.id}/photo.jpg`);
    expect(r.photoWidth).toBe(src.photoWidth);
    expect(r.photoHeight).toBe(src.photoHeight);
    const [a, b] = await Promise.all([getFile(src.photoUrl), getFile(r.photoUrl)]);
    expect(b.equals(a)).toBe(true);
  });

  it("render di partenza inesistente → errore italiano", async () => {
    await expect(createRender(baseInput({ photo: undefined, sourceRenderId: "nessuno" }))).rejects.toThrow(
      "Render di partenza non trovato",
    );
  });

  it("serve esattamente una tra foto e sourceRenderId", async () => {
    const src = await newRender();
    await expect(createRender(baseInput({ sourceRenderId: src.id }))).rejects.toThrow(
      "Carica una nuova foto oppure riusa quella del render di partenza, non entrambe",
    );
    await expect(createRender(baseInput({ photo: undefined }))).rejects.toThrow("Carica una foto");
  });
});

describe("getRenderDraft", () => {
  it("copia tutti i parametri tranne la variante scelta", async () => {
    const scaleLine = { a: { x: 0.1, y: 0.5 }, b: { x: 0.35, y: 0.5 }, lengthMm: 900 };
    const src = await newRender({
      scaleLine,
      positionText: "sopra il patio",
      prompt: "Prompt a mano",
      fabricId: undefined,
      quality: "medium",
      variantsRequested: 2,
      disclaimer: true,
    });
    store.renders.get(src.id)!.chosenVariantId = "v-scelta";
    const d = await getRenderDraft(src.id);
    expect(d).toEqual({
      sourceRenderId: src.id,
      clientRef: "Rossi 12",
      productId: "p1",
      productName: "ZENIT – Addossata frontale",
      widthMm: 4200,
      depthMm: 3800,
      clearHeightMm: 2400,
      totalHeightMm: 2746,
      colorId: "c1",
      fabricId: null,
      polygon: POLYGON,
      positionText: "sopra il patio",
      scaleLine,
      prompt: "Prompt a mano",
      providerId: "openai",
      model: "gpt-image-2",
      quality: "medium",
      variantsRequested: 2,
      disclaimer: true,
      photoUrl: src.photoUrl,
      photoWidth: W,
      photoHeight: H,
    });
    expect(d).not.toHaveProperty("chosenVariantId");
  });

  it("prodotto eliminato → productId null (il modulo chiederà di sceglierlo)", async () => {
    const src = await newRender({ polygon: undefined, positionText: "a destra" });
    store.products.delete("p1");
    store.renders.get(src.id)!.productId = null;
    const d = await getRenderDraft(src.id);
    expect(d).toMatchObject({ productId: null, productName: "ZENIT – Addossata frontale", polygon: null, scaleLine: null });
  });

  it("render inesistente → null", async () => {
    expect(await getRenderDraft("nessuno")).toBeNull();
  });
});

// --- generateVariant ------------------------------------------------------------

describe("generateVariant", () => {
  it("con poligono: DONE, protetta, la casa resta quella della foto", async () => {
    const r = await newRender();
    const { provider, calls } = fakeProvider();
    const v = await generateVariant(r.id, { provider });

    expect(v.status).toBe("DONE");
    expect(v.protected).toBe(true);
    expect(v.error).toBeNull();
    expect(v.imageUrl).toMatch(new RegExp(`^/api/files/renders/${r.id}/.+\\.jpg$`));

    // Il fornitore riceve foto e maschera alla sua dimensione e i riferimenti in ordine.
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(await sharp(call.photo).metadata()).toMatchObject({ width: 1536, height: 1024 });
    expect(call.mask).toBeDefined();
    expect(await sharp(call.mask!).metadata()).toMatchObject({ width: 1536, height: 1024 });
    expect(call.references).toHaveLength(2);
    expect(call.prompt).toBe(r.prompt);
    expect(call.model).toBe("gpt-image-2");
    expect(call.quality).toBe("high");

    const out = await rgb(await getFile(v.imageUrl!));
    const orig = await rgb(await getFile(r.photoUrl));
    expect(out.info).toMatchObject({ width: W, height: H, channels: 3 });

    // Lontano dalla sagoma (fuori dal riquadro 0.3..0.7) i pixel coincidono con la foto.
    expect(meanDiffOutside(out.data, orig.data)).toBeLessThan(2);

    // Al centro c'è l'immagine generata (rossa).
    const c = ((H / 2) * W + W / 2) * 3;
    expect(out.data[c]).toBeGreaterThan(230);
    expect(out.data[c + 1]).toBeLessThan(30);
  });

  it("salva il punteggio di scena alterata: alto se il fornitore rifà la scena, ~0 se la conserva", async () => {
    const r = await newRender();
    const redo = fakeProvider(); // rosso uniforme: tutta la scena diversa dalla foto
    const v1 = await generateVariant(r.id, { provider: redo.provider });
    expect(store.variants.get(v1.id)!.driftScore).toBeGreaterThan(DRIFT_ALTERED_THRESHOLD);

    const keep = { ...redo.provider, generate: async (i: { photo: Buffer }) => i.photo }; // rimanda la foto così com'è
    const v2 = await generateVariant(r.id, { provider: keep });
    expect(store.variants.get(v2.id)!.driftScore).toBeLessThan(1);
  });

  it("senza sagoma il punteggio non si calcola (null)", async () => {
    const r = await newRender({ polygon: undefined, positionText: "a destra della porta" });
    const v = await generateVariant(r.id, { provider: fakeProvider().provider });
    expect(store.variants.get(v.id)!.driftScore ?? null).toBeNull();
  });

  /** Fornitore che restituisce la foto con un rettangolo scuro (la "pergola") dal bordo sinistro della sagoma fino a x1. */
  function paintingProvider(x1: number, y0 = 0.4, y1 = 0.6) {
    const base = fakeProvider();
    return {
      ...base,
      provider: {
        ...base.provider,
        generate: async (input: GenerateInput) => {
          const { width, height } = await sharp(input.photo).metadata();
          const left = Math.round(0.4 * width!);
          const top = Math.round(y0 * height!);
          const rect = {
            create: { width: Math.round(x1 * width!) - left, height: Math.round((y1 - y0) * height!), channels: 3 as const, background: { r: 10, g: 10, b: 10 } },
          };
          return sharp(input.photo).composite([{ input: rect, left, top }]).png().toBuffer();
        },
      },
    };
  }

  it("ricomposizione adattiva: la pergola che esce dalla sagoma non viene tagliata", async () => {
    const r = await newRender();
    const v = await generateVariant(r.id, { provider: paintingProvider(0.7).provider });
    expect(v.status).toBe("DONE");
    const out = await rgb(await getFile(v.imageUrl!));
    const at = (fx: number, fy: number) => out.data[(Math.round(fy * H) * W + Math.round(fx * W)) * 3];
    expect(at(0.66, 0.5)).toBeLessThan(60); // fuori sagoma e dentro la struttura: scuro, non tagliato
    expect(at(0.85, 0.5)).toBeGreaterThan(120); // più in là la scena è quella originale
    const row = store.variants.get(v.id)!;
    expect(row.truncated).toBe(false);
    expect(row.driftScore as number).toBeLessThan(DRIFT_ALTERED_THRESHOLD);
  });

  it("se la struttura va oltre il tetto di crescita la variante è segnalata come tagliata", async () => {
    const r = await newRender();
    const v = await generateVariant(r.id, { provider: paintingProvider(0.95, 0.35, 0.65).provider });
    expect(store.variants.get(v.id)!.truncated).toBe(true);
    const out = await rgb(await getFile(v.imageUrl!));
    expect(out.data[(Math.round(0.5 * H) * W + Math.round(0.93 * W)) * 3]).toBeGreaterThan(120); // oltre il tetto di crescita: originale
  });

  it("scena rifatta (punteggio alto): la maschera NON cresce e la casa resta quella della foto", async () => {
    const r = await newRender();
    const v = await generateVariant(r.id, { provider: fakeProvider().provider }); // tutto rosso
    const row = store.variants.get(v.id)!;
    expect(row.truncated).toBe(false);
    const out = await rgb(await getFile(v.imageUrl!));
    const orig = await rgb(await getFile(r.photoUrl));
    expect(meanDiffOutside(out.data, orig.data)).toBeLessThan(2);
  });

  it("senza poligono: protected false, immagine generata alla risoluzione della foto", async () => {
    const r = await newRender({ polygon: undefined, positionText: "a destra della porta" });
    const { provider, calls } = fakeProvider();
    const v = await generateVariant(r.id, { provider });
    expect(v.status).toBe("DONE");
    expect(v.protected).toBe(false);
    expect(calls[0].mask).toBeUndefined();
    const meta = await sharp(await getFile(v.imageUrl!)).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: W, height: H, chromaSubsampling: "4:4:4" });
  });

  it("fornitore che non applica la maschera: la riceve comunque come indicazione e la variante è protetta", async () => {
    const r = await newRender();
    const { provider, calls } = fakeProvider({ supportsMask: false });
    const v = await generateVariant(r.id, { provider });
    expect(v.status).toBe("DONE");
    expect(v.protected).toBe(true);
    expect(calls[0].mask).toBeDefined();
    expect(await sharp(calls[0].mask!).metadata()).toMatchObject({ width: 1536, height: 1024 });
    // La ricomposizione è avvenuta comunque: fuori dalla sagoma resta la foto, al centro il rosso.
    const out = await rgb(await getFile(v.imageUrl!));
    const orig = await rgb(await getFile(r.photoUrl));
    expect(meanDiffOutside(out.data, orig.data)).toBeLessThan(2);
    const c = ((H / 2) * W + W / 2) * 3;
    expect(out.data[c]).toBeGreaterThan(230);
  });

  it("se anche il salvataggio dell'errore fallisce, si risolve comunque con una variante FAILED", async () => {
    const r = await newRender();
    const { provider } = fakeProvider({ fail: new ProviderError("timeout", "x") });
    const spy = vi.spyOn(db.variant, "update").mockRejectedValue(new Error("db giù"));
    try {
      const v = await generateVariant(r.id, { provider });
      expect(v).toMatchObject({ renderId: r.id, status: "FAILED", error: "Tempo scaduto, riprova", imageUrl: null });
      expect(v.protected).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("prodotto eliminato: genera senza riferimenti", async () => {
    const r = await newRender();
    store.renders.get(r.id)!.productId = null;
    const { provider, calls } = fakeProvider();
    const v = await generateVariant(r.id, { provider });
    expect(v.status).toBe("DONE");
    expect(calls[0].references).toHaveLength(0);
  });

  it("errore rejected → FAILED con messaggio italiano, senza rilanciare", async () => {
    const r = await newRender();
    const { provider } = fakeProvider({ fail: new ProviderError("rejected", "moderation") });
    const v = await generateVariant(r.id, { provider });
    expect(v.status).toBe("FAILED");
    expect(v.error).toBe("Il fornitore ha rifiutato la richiesta");
    expect(v.imageUrl).toBeNull();
    expect(store.variants.get(v.id)!.status).toBe("FAILED");
  });

  it.each([
    [new ProviderError("config", "x"), "Fornitore non configurato: manca la chiave API"],
    [new ProviderError("timeout", "x"), "Tempo scaduto, riprova"],
    [
      new ProviderError("quota", "x"),
      "Quota o credito del fornitore esauriti: controlla piano e fatturazione dell'account, poi riprova",
    ],
    [new ProviderError("upstream", "x"), "Errore del fornitore, riprova"],
    [new Error("boom"), "Errore del fornitore, riprova"],
  ])("errore %s → messaggio dedicato", async (err, msg) => {
    const r = await newRender();
    const { provider } = fakeProvider({ fail: err as ProviderError });
    const v = await generateVariant(r.id, { provider });
    expect(v).toMatchObject({ status: "FAILED", error: msg });
  });
});

// --- Route ----------------------------------------------------------------------

function renderForm(over: Record<string, string | Blob | undefined> = {}) {
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
    ...over,
  };
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, v);
  return form;
}

const post = (form: FormData) => new Request("http://localhost/api/renders", { method: "POST", body: form });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/renders", () => {
  it("crea il render e restituisce l'id", async () => {
    const res = await postRender(post(renderForm()));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    createdRenders.add(id);
    expect(store.renders.get(id)).toMatchObject({ clientRef: "Rossi 12", variantsRequested: 2, widthMm: 4200 });
  });

  it("usa il tetto di risoluzione delle impostazioni: la foto si riduce al lato lungo indicato", async () => {
    store.maxPhotoSide = 600;
    try {
      const res = await postRender(post(renderForm()));
      expect(res.status).toBe(200);
      const { id } = (await res.json()) as { id: string };
      createdRenders.add(id);
      expect(store.renders.get(id)).toMatchObject({ photoWidth: 600, photoHeight: 450 });
    } finally {
      store.maxPhotoSide = 3000;
    }
  });

  it("errore di validazione → 400 con messaggio italiano", async () => {
    const res = await postRender(post(renderForm({ polygon: undefined, positionText: "" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Indica la posizione: disegna la sagoma o descrivila a parole" });
  });

  it("JSON della sagoma non valido → 400", async () => {
    const res = await postRender(post(renderForm({ polygon: "{non json" })));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/sagoma/i);
  });

  it("foto oltre 4 MB → 413", async () => {
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    const res = await postRender(post(renderForm({ photo: big })));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: "La foto è troppo grande (max 4 MB): riprova, l'app la ridimensiona automaticamente",
    });
  });

  it("corpo oltre 5 MB (Content-Length) → 413 senza leggere il modulo", async () => {
    const req = new Request("http://localhost/api/renders", {
      method: "POST",
      headers: { "content-length": String(6 * 1024 * 1024), "content-type": "multipart/form-data; boundary=x" },
      body: "--x--",
    });
    const res = await postRender(req);
    expect(res.status).toBe(413);
  });

  it("sourceRenderId al posto della foto → crea il render con la foto copiata", async () => {
    const src = await newRender();
    const res = await postRender(post(renderForm({ photo: undefined, sourceRenderId: src.id })));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    createdRenders.add(id);
    expect(store.renders.get(id)).toMatchObject({ photoUrl: `/api/files/renders/${id}/photo.jpg`, photoWidth: W });
  });

  it("sourceRenderId sconosciuto → 404 con messaggio italiano", async () => {
    const res = await postRender(post(renderForm({ photo: undefined, sourceRenderId: "nessuno" })));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Render di partenza non trovato" });
  });

  it("foto e sourceRenderId insieme → 400", async () => {
    const src = await newRender();
    const res = await postRender(post(renderForm({ sourceRenderId: src.id })));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/non entrambe/);
  });

  it("foto mancante → 400", async () => {
    const res = await postRender(post(renderForm({ photo: undefined })));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/renders/[id]/variants e download", () => {
  it("id sconosciuto → 404", async () => {
    const res = await postVariant(new Request("http://localhost", { method: "POST" }), ctx("sconosciuto"));
    expect(res.status).toBe(404);
    const dl = await downloadVariant(new Request("http://localhost"), ctx("sconosciuto"));
    expect(dl.status).toBe(404);
  });

  it("fornitore del render disabilitato nelle impostazioni → 400 senza generare", async () => {
    const r = await newRender();
    const before = store.variants.size;
    store.enabledProviders = ["openrouter"];
    try {
      const res = await postVariant(new Request("http://localhost", { method: "POST" }), ctx(r.id));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Fornitore OpenAI disabilitato nelle impostazioni: duplica il render e scegli un altro fornitore",
      });
      expect(store.variants.size).toBe(before);
    } finally {
      store.enabledProviders = ["openai", "openrouter"];
    }
  });

  it("download di una variante su Vercel Blob: redirect 302 all'URL di download, senza leggere il file", async () => {
    const r = await newRender();
    const { provider } = fakeProvider();
    const v = await generateVariant(r.id, { provider });
    const blobUrl = "https://abc123.public.blob.vercel-storage.com/renders/x/v-AbC.jpg";
    store.variants.get(v.id)!.imageUrl = blobUrl;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const res = await downloadVariant(new Request("http://localhost"), ctx(v.id));
      expect(res.status).toBe(302);
      const loc = new URL(res.headers.get("location")!);
      expect(`${loc.origin}${loc.pathname}`).toBe(blobUrl);
      expect(loc.searchParams.get("download")).toBe("1");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("download con nome file ripulito", async () => {
    const r = await newRender({ clientRef: 'Ros"si\r\nX: y/../' });
    const { provider } = fakeProvider();
    const v = await generateVariant(r.id, { provider });
    const res = await downloadVariant(new Request("http://localhost"), ctx(v.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const cd = res.headers.get("content-disposition")!;
    expect(cd).toMatch(/^attachment; filename="GibusRender-[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.jpg"$/);
    expect(cd).toContain(`-${v.id}.jpg`);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(await getFile(v.imageUrl!))).toBe(true);
  });
});

describe("isStale", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const v = (status: string, minutesAgo: number) => ({
    status,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000),
  });
  it("PENDING da più di 6 minuti → true", () => {
    expect(isStale(v("PENDING", 6.1), now)).toBe(true);
    expect(isStale(v("PENDING", 60), now)).toBe(true);
  });
  it("PENDING recente, oppure DONE/FAILED → false", () => {
    expect(isStale(v("PENDING", 5.9), now)).toBe(false);
    expect(isStale(v("PENDING", 6), now)).toBe(false);
    expect(isStale(v("DONE", 60), now)).toBe(false);
    expect(isStale(v("FAILED", 60), now)).toBe(false);
  });
  it("usa l'ora corrente per default", () => {
    expect(isStale({ status: "PENDING", createdAt: new Date(Date.now() - 7 * 60_000) })).toBe(true);
  });
});
