import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COVER_LABELS, MOUNT_LABELS, SEED_FINISHES, SEED_PRODUCTS } from "@/lib/catalog/types";

const IMAGES_DIR = path.join(process.cwd(), "seed", "images");

const EXPECTED = [
  { name: "ZENIT – Addossata frontale", mountType: "ADDOSSATA", coverType: "TELO", widthMm: 4200, depthMm: 3800, clearHeightMm: 2400, totalHeightMm: 2746, ref: "p1", posts: 2 },
  { name: "Lamella Compact", mountType: "AUTOPORTANTE", coverType: "LAMELLE_ORIENTABILI", widthMm: 3000, depthMm: 3080, clearHeightMm: 2400, totalHeightMm: 2550, ref: "p2", posts: 4 },
  { name: "Bioclima Orient", mountType: "AUTOPORTANTE", coverType: "LAMELLE_ORIENTABILI", widthMm: 4000, depthMm: 5000, clearHeightMm: 2400, totalHeightMm: 2650, ref: "p3", posts: 4 },
  { name: "Bioclima Pack", mountType: "AUTOPORTANTE", coverType: "LAMELLE_IMPACCHETTAMENTO", widthMm: 4000, depthMm: 4900, clearHeightMm: 2400, totalHeightMm: 2650, ref: "p4", posts: 4 },
  // Prodotto con foto reali Gibus come riferimento (nome provvisorio, misure tipo scelte dal redattore)
  { name: "Bioclima Addossata", mountType: "ADDOSSATA", coverType: "LAMELLE_ORIENTABILI", widthMm: 4000, depthMm: 3000, clearHeightMm: 2400, totalHeightMm: 2650, ref: "foto", posts: 2 },
] as const;

const NUMBER_WORDS: Record<number, string> = { 2: "two", 4: "four" };

const COLOR = { kind: "COLORE", name: "Antracite RAL 7016 sablé", code: "RAL 7016", swatchHex: "#383E42" };
const FABRIC = { kind: "TESSUTO", name: "Opatex Pro/Opatex Decò OP 272", code: "OP 272" };

describe("SEED_PRODUCTS", () => {
  it("contiene esattamente i 5 prodotti attesi (4 dai PDF, 1 con foto reali)", () => {
    expect(SEED_PRODUCTS).toHaveLength(5);
    SEED_PRODUCTS.forEach((p, i) => {
      const e = EXPECTED[i];
      expect({
        name: p.name,
        mountType: p.mountType,
        coverType: p.coverType,
        widthMm: p.widthMm,
        depthMm: p.depthMm,
        clearHeightMm: p.clearHeightMm,
        totalHeightMm: p.totalHeightMm,
      }).toEqual({
        name: e.name,
        mountType: e.mountType,
        coverType: e.coverType,
        widthMm: e.widthMm,
        depthMm: e.depthMm,
        clearHeightMm: e.clearHeightMm,
        totalHeightMm: e.totalHeightMm,
      });
    });
  });

  it("i prodotti dai PDF hanno 3 riferimenti (disegni) esistenti in seed/images", () => {
    SEED_PRODUCTS.slice(0, 4).forEach((p, i) => {
      const ref = EXPECTED[i].ref;
      expect(p.references.map((r) => r.file)).toEqual([`${ref}-3d.png`, `${ref}-frontale.png`, `${ref}-pianta.png`]);
      for (const r of p.references) {
        expect(fs.existsSync(path.join(IMAGES_DIR, r.file)), r.file).toBe(true);
        expect(r.label.length).toBeGreaterThan(0);
      }
    });
  });

  it("il prodotto con foto reali ha 2 riferimenti fotografici esistenti, senza disegni tecnici", () => {
    const p = SEED_PRODUCTS[4];
    expect(p.references.map((r) => r.file)).toEqual(["azimut-intera.jpg", "azimut-dettaglio.jpg"]);
    for (const r of p.references) {
      expect(fs.existsSync(path.join(IMAGES_DIR, r.file)), r.file).toBe(true);
      expect(r.label).toMatch(/^Foto reale Gibus/);
    }
  });

  it("le aiDescription sono lunghe almeno 200 caratteri e indicano il numero dei montanti", () => {
    SEED_PRODUCTS.forEach((p, i) => {
      const n = EXPECTED[i].posts;
      expect(p.aiDescription.length, p.name).toBeGreaterThanOrEqual(200);
      // il numero (cifra o parola inglese) deve precedere direttamente "post"/"posts", con al più un paio di aggettivi
      const re = new RegExp(`\\b(${n}|${NUMBER_WORDS[n]})\\b(\\s+[\\w-]+){0,3}?\\s+posts?\\b`, "i");
      expect(p.aiDescription, p.name).toMatch(re);
    });
  });

  it("finiture seed e predefiniti: ZENIT colore + tessuto, gli altri solo colore", () => {
    expect(SEED_FINISHES).toEqual([COLOR, FABRIC]);
    SEED_PRODUCTS.forEach((p, i) => {
      expect(p.defaultColorCode).toBe("RAL 7016");
      if (i === 0) {
        expect(p.defaultFabricCode).toBe("OP 272");
        expect(p.finishCodes).toEqual(["RAL 7016", "OP 272"]);
      } else {
        expect(p.defaultFabricCode).toBeNull();
        expect(p.finishCodes).toEqual(["RAL 7016"]);
      }
    });
  });

  it("etichette italiane per montaggio e copertura", () => {
    expect(Object.keys(MOUNT_LABELS).sort()).toEqual(["ADDOSSATA", "AUTOPORTANTE"]);
    expect(Object.keys(COVER_LABELS).sort()).toEqual(["LAMELLE_IMPACCHETTAMENTO", "LAMELLE_ORIENTABILI", "TELO"]);
  });
});
