import { afterEach, describe, expect, it, vi } from "vitest";
import {
  archiveEntries,
  archiveThumbnail,
  clampPage,
  localVariantFailure,
  postVariant,
  recommendationReason,
  recommendedVariant,
  shouldAutoStart,
  variantFromJson,
  visibleVariants,
  type VariantInfo,
} from "@/lib/render/variant-list";

function v(id: string, status: VariantInfo["status"], createdAt: string, over: Partial<VariantInfo> = {}): VariantInfo {
  return {
    id,
    status,
    imageUrl: status === "DONE" ? `/api/files/${id}.jpg` : null,
    protected: true,
    error: status === "FAILED" ? "Fornitore non configurato: manca la chiave API" : null,
    stale: false,
    createdAt,
    ...over,
  };
}

const T = (s: number) => new Date(Date.UTC(2026, 10, 9, 15, 0, s)).toISOString();
const ids = (cards: ReturnType<typeof visibleVariants>) =>
  cards.map((c) => (c.kind === "variant" ? `${c.n}:${c.v.id}:${c.v.status}` : `${c.n}:${c.key}:…`));

describe("visibleVariants", () => {
  it("lotto parallelo con 1 FAILED e 2 DONE: tutte e 3 visibili", () => {
    const server = [v("a", "DONE", T(1)), v("b", "FAILED", T(1)), v("c", "DONE", T(2))];
    expect(ids(visibleVariants(server, [], [], new Set()))).toEqual(["1:a:DONE", "2:b:FAILED", "3:c:DONE"]);
  });

  it("le risposte locali sostituiscono le righe del server con lo stesso id, senza duplicati", () => {
    const server = [v("a", "PENDING", T(1)), v("b", "PENDING", T(2))];
    const local = [v("b", "DONE", T(2)), v("a", "FAILED", T(1))];
    expect(ids(visibleVariants(server, local, [], new Set()))).toEqual(["1:a:FAILED", "2:b:DONE"]);
  });

  it("ordine stabile per createdAt e poi id, qualunque sia l'ordine di arrivo", () => {
    const local = [v("z", "DONE", T(5)), v("b", "DONE", T(3)), v("a", "DONE", T(3))];
    expect(ids(visibleVariants([], local, [], new Set()))).toEqual(["1:a:DONE", "2:b:DONE", "3:z:DONE"]);
  });

  it("esclude le nascoste ma mantiene la numerazione stabile", () => {
    const server = [v("a", "FAILED", T(1)), v("b", "DONE", T(2)), v("c", "FAILED", T(3))];
    expect(ids(visibleVariants(server, [], [], new Set(["a"])))).toEqual(["2:b:DONE", "3:c:FAILED"]);
  });

  it("le fallite e le scadute restano visibili anche dopo una variante riuscita", () => {
    const server = [v("a", "FAILED", T(1)), v("s", "PENDING", T(0), { stale: true }), v("b", "DONE", T(9))];
    expect(ids(visibleVariants(server, [], [], new Set()))).toEqual(["1:s:PENDING", "2:a:FAILED", "3:b:DONE"]);
  });

  it("con richieste in corso le PENDING del server sono già i segnaposto; i segnaposto vanno in fondo", () => {
    const server = [v("a", "DONE", T(1)), v("p", "PENDING", T(2)), v("s", "PENDING", T(0), { stale: true })];
    expect(ids(visibleVariants(server, [], ["tmp-1"], new Set()))).toEqual([
      "1:s:PENDING",
      "2:a:DONE",
      "3:tmp-1:…",
    ]);
  });

  it("senza richieste in corso le PENDING del server si mostrano", () => {
    const server = [v("p", "PENDING", T(2))];
    expect(ids(visibleVariants(server, [], [], new Set()))).toEqual(["1:p:PENDING"]);
  });

  it("gli errori locali senza riga sul server (rete) vanno dopo le varianti reali, nell'ordine di arrivo", () => {
    const net = v("tmp-2", "FAILED", T(0), { local: true });
    const server = [v("a", "DONE", T(5))];
    expect(ids(visibleVariants(server, [net], [], new Set()))).toEqual(["1:a:DONE", "2:tmp-2:FAILED"]);
  });
});

describe("archiveThumbnail", () => {
  const photoUrl = "/api/files/photo.jpg";
  const d = (id: string, status: string, s: number) => ({
    id,
    status,
    imageUrl: status === "DONE" ? `/api/files/${id}.jpg` : null,
    createdAt: new Date(T(s)),
  });

  it("usa la variante scelta se è DONE", () => {
    expect(archiveThumbnail({ photoUrl, chosenVariantId: "b", variants: [d("a", "DONE", 1), d("b", "DONE", 2)] })).toBe(
      "/api/files/b.jpg",
    );
  });

  it("altrimenti la prima DONE per data", () => {
    expect(
      archiveThumbnail({ photoUrl, chosenVariantId: "x", variants: [d("c", "DONE", 3), d("f", "FAILED", 0), d("a", "DONE", 1)] }),
    ).toBe("/api/files/a.jpg");
    expect(archiveThumbnail({ photoUrl, chosenVariantId: "f", variants: [d("f", "FAILED", 0), d("a", "DONE", 1)] })).toBe(
      "/api/files/a.jpg",
    );
  });

  it("altrimenti la foto originale", () => {
    expect(archiveThumbnail({ photoUrl, chosenVariantId: null, variants: [d("f", "FAILED", 0)] })).toBe(photoUrl);
    expect(archiveThumbnail({ photoUrl, chosenVariantId: null, variants: [] })).toBe(photoUrl);
  });
});

describe("shouldAutoStart", () => {
  it("parte solo con avvia=1 e una sola volta", () => {
    expect(shouldAutoStart(new URLSearchParams("avvia=1"), false)).toBe(true);
    expect(shouldAutoStart(new URLSearchParams("avvia=1"), true)).toBe(false);
    expect(shouldAutoStart(new URLSearchParams(""), false)).toBe(false);
    expect(shouldAutoStart(new URLSearchParams("avvia=0"), false)).toBe(false);
    expect(shouldAutoStart(new URLSearchParams("avvia=si"), false)).toBe(false);
  });
});

describe("clampPage", () => {
  it("intero tra 1 e il numero di pagine; valori strani → 1", () => {
    expect(clampPage("2", 3)).toBe(2);
    expect(clampPage("2.7", 3)).toBe(2);
    expect(clampPage("99", 3)).toBe(3);
    expect(clampPage("0", 3)).toBe(1);
    expect(clampPage("-4", 3)).toBe(1);
    expect(clampPage("abc", 3)).toBe(1);
    expect(clampPage("Infinity", 3)).toBe(1);
    expect(clampPage("1e400", 3)).toBe(1);
    expect(clampPage(undefined, 3)).toBe(1);
    expect(clampPage(["2", "3"], 3)).toBe(1);
    expect(clampPage("5", 0)).toBe(1);
  });
});

describe("recommendedVariant", () => {
  const withVol = { hasVolume: true };
  const noVol = { hasVolume: false };
  const off = (n: number, over: Partial<VariantInfo> = {}) => ({ placementOffset: n, driftScore: 5, ...over });

  it("con volume: la più vicina al volume, escluse le fuori posto", () => {
    const list = [
      v("a", "DONE", T(1), off(0.12)),
      v("b", "DONE", T(2), off(0.08)),
      v("c", "DONE", T(3), off(0.3)),
    ];
    expect(recommendedVariant(list, withVol)).toBe("b");
  });

  it("senza volume: la scena più fedele (drift minore)", () => {
    const list = [v("a", "DONE", T(1), { driftScore: 6.1 }), v("b", "DONE", T(2), { driftScore: 4.4 })];
    expect(recommendedVariant(list, noVol)).toBe("b");
  });

  it("parità: la più vecchia per createdAt, poi id", () => {
    expect(
      recommendedVariant([v("b", "DONE", T(2), off(0.1)), v("a", "DONE", T(1), off(0.1))], withVol),
    ).toBe("a");
    expect(
      recommendedVariant([v("b", "DONE", T(1), off(0.1)), v("a", "DONE", T(1), off(0.1))], withVol),
    ).toBe("a");
  });

  const loser = v("z", "DONE", T(9), off(0.2));
  const winnerOver = (over: Partial<VariantInfo>, volume = true) =>
    recommendedVariant([v("w", "DONE", T(1), { ...off(0.01), ...over }), loser, v("y", "DONE", T(8), off(0.22, { driftScore: 7 }))], {
      hasVolume: volume,
    });

  it.each([
    ["non protetta", { protected: false }],
    ["troncata", { truncated: true }],
    ["scena alterata", { driftScore: 13 }],
    ["fuori posto", { placementOffset: 0.26 }],
    ["stale", { stale: true }],
    ["fallita", { status: "FAILED" as const }],
  ])("esclude la variante %s", (_n, over) => {
    expect(winnerOver(over)).toBe("z");
  });

  it("con volume, offset null esclude; senza volume, drift null esclude", () => {
    expect(winnerOver({ placementOffset: null })).toBe("z");
    expect(winnerOver({ driftScore: null }, false)).toBe("z");
  });

  it("una sola variante DONE, anche perfetta → null", () => {
    expect(recommendedVariant([v("a", "DONE", T(1), off(0))], withVol)).toBeNull();
    expect(recommendedVariant([v("a", "DONE", T(1), off(0)), v("b", "FAILED", T(2))], withVol)).toBeNull();
  });

  it("tutte con avvisi → null", () => {
    const list = [v("a", "DONE", T(1), off(0.3)), v("b", "DONE", T(2), off(0.4))];
    expect(recommendedVariant(list, withVol)).toBeNull();
  });

  it("render vecchio senza punteggi → null", () => {
    const list = [v("a", "DONE", T(1)), v("b", "DONE", T(2)), v("c", "DONE", T(3))];
    expect(recommendedVariant(list, noVol)).toBeNull();
  });

  it("motivo della raccomandazione", () => {
    expect(recommendationReason(true)).toBe("Nessun avviso e la più vicina al volume");
    expect(recommendationReason(false)).toBe("Nessun avviso e la scena più fedele alla foto");
  });
});

describe("variantFromJson", () => {
  it("null su oggetto vuoto e su status sconosciuto", () => {
    expect(variantFromJson({})).toBeNull();
    expect(variantFromJson({ id: "a", createdAt: T(1), status: "BOH" })).toBeNull();
  });

  it("legge placementOffset", () => {
    const r = variantFromJson({ id: "a", createdAt: T(1), status: "DONE", placementOffset: 0.1 });
    expect(r?.placementOffset).toBe(0.1);
  });

  it("localVariantFailure crea un errore locale", () => {
    expect(localVariantFailure("k", "x")).toMatchObject({ id: "k", status: "FAILED", error: "x", local: true });
  });
});

describe("postVariant", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (status: number, body: unknown) =>
    vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

  it("chiama la route delle varianti del render e restituisce la variante", async () => {
    const fetchMock = respond(200, { id: "v1", createdAt: T(1), status: "DONE", imageUrl: "/x.jpg", protected: true });
    vi.stubGlobal("fetch", fetchMock);
    const v = await postVariant("r1", "tmp-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/renders/r1/variants", { method: "POST" });
    expect(v).toMatchObject({ id: "v1", status: "DONE", imageUrl: "/x.jpg" });
    expect(v.local).toBeUndefined();
  });

  it("errore del server con messaggio: scheda locale con il messaggio", async () => {
    vi.stubGlobal("fetch", respond(409, { error: "Fornitore disabilitato" }));
    expect(await postVariant("r1", "tmp-2")).toMatchObject({
      id: "tmp-2",
      status: "FAILED",
      error: "Fornitore disabilitato",
      local: true,
    });
  });

  it("errore del server senza messaggio o risposta non valida: Errore del server (N)", async () => {
    vi.stubGlobal("fetch", respond(500, "non json"));
    expect(await postVariant("r1", "tmp-3")).toMatchObject({ id: "tmp-3", error: "Errore del server (500)", local: true });
    vi.stubGlobal("fetch", respond(200, { id: "v1" }));
    expect(await postVariant("r1", "tmp-4")).toMatchObject({ id: "tmp-4", error: "Errore del server (200)", local: true });
  });

  it("errore di rete: non rifiuta, restituisce Errore di rete, riprova", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await postVariant("r1", "tmp-5")).toMatchObject({ id: "tmp-5", error: "Errore di rete, riprova", local: true });
  });
});

describe("archiveEntries", () => {
  const row = (id: string, comparisonId: string | null) => ({ id, comparisonId, createdAt: new Date(0) });

  it("un confronto compare una volta, nella posizione della riga più recente", () => {
    const rows = [row("r5", "c1"), row("r4", null), row("r3", "c1"), row("r2", "c2"), row("r1", null)];
    expect(archiveEntries(rows)).toEqual([
      { kind: "comparison", comparisonId: "c1", renderIds: ["r5", "r3"] },
      { kind: "render", renderId: "r4" },
      { kind: "comparison", comparisonId: "c2", renderIds: ["r2"] },
      { kind: "render", renderId: "r1" },
    ]);
  });

  it("senza confronti: una voce per render, stesso ordine", () => {
    expect(archiveEntries([row("b", null), row("a", null)])).toEqual([
      { kind: "render", renderId: "b" },
      { kind: "render", renderId: "a" },
    ]);
  });
});
