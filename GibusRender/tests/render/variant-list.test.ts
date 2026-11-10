import { describe, expect, it } from "vitest";
import {
  archiveThumbnail,
  clampPage,
  shouldAutoStart,
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
