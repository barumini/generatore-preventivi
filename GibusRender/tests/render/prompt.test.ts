import { describe, expect, it } from "vitest";
import { buildPrompt, type PromptInput } from "@/lib/render/prompt";

const zenit: PromptInput = {
  product: {
    name: "ZENIT – Addossata frontale",
    mountType: "ADDOSSATA",
    coverType: "TELO",
    aiDescription: "Wall-mounted aluminium pergola with a taut fabric canopy.",
  },
  dims: { widthMm: 4200, depthMm: 3800, clearHeightMm: 2400, totalHeightMm: 2746 },
  color: { name: "Antracite RAL 7016 sablé", code: "RAL 7016" },
  fabric: { name: "Opatex Pro/Opatex Decò OP 272", code: "OP 272" },
  positionText: "addossata alla parete a destra",
  hasMask: true,
  maskHint: false,
  referenceCount: 3,
};

describe("buildPrompt", () => {
  it("contiene misure, finiture, posizione e vincoli fissi (con maschera)", () => {
    const p = buildPrompt(zenit);
    for (const s of [
      "4200 mm",
      "3800 mm",
      "2400 mm",
      "2746 mm",
      "RAL 7016",
      "OP 272",
      "addossata alla parete a destra",
      "Do not change anything outside the masked area",
      "Reproduce the product exactly as shown in the reference images",
    ]) {
      expect(p).toContain(s);
    }
    expect(p).toContain(zenit.product.aiDescription);
    expect(p).not.toContain("Do not change the existing building, ground, vegetation or objects");
  });

  it("riporta il testo libero dell'utente tra virgolette, così com'è", () => {
    const p = buildPrompt({ ...zenit, positionText: '  sopra il "dehors", lato sud ' });
    expect(p).toContain('"  sopra il "dehors", lato sud "');
  });

  it("senza maschera vieta di modificare casa, terreno e oggetti", () => {
    const p = buildPrompt({ ...zenit, hasMask: false });
    expect(p).toContain("Do not change the existing building, ground, vegetation or objects");
    expect(p).not.toContain("Do not change anything outside the masked area");
  });

  it("con la scala indica la misura nota 'for scale'", () => {
    const p = buildPrompt({ ...zenit, scale: { lengthMm: 900, pixelLength: 120, photoWidth: 1500 } });
    expect(p).toContain("for scale");
    expect(p).toContain("900 mm");
    expect(buildPrompt(zenit)).not.toContain("for scale");
  });

  it("senza tessuto la parola fabric non compare", () => {
    const p = buildPrompt({
      ...zenit,
      product: { ...zenit.product, coverType: "LAMELLE_ORIENTABILI", aiDescription: "Freestanding louvred pergola." },
      fabric: undefined,
    });
    expect(p.toLowerCase()).not.toContain("fabric");
  });

  it("descrive il tipo di montaggio e il numero di immagini di riferimento", () => {
    const p = buildPrompt(zenit);
    expect(p).toContain("3 reference images");
    expect(p.toLowerCase()).toContain("wall-mounted");
    const free = buildPrompt({ ...zenit, product: { ...zenit.product, mountType: "AUTOPORTANTE" } });
    expect(free.toLowerCase()).toContain("freestanding");
  });
});

describe("buildPrompt: sagoma come indicazione (fornitore che non applica la maschera)", () => {
  it("con maskHint chiede di posizionare la pergola nell'area bianca della maschera", () => {
    const p = buildPrompt({ ...zenit, hasMask: false, maskHint: true });
    expect(p).toContain("The pergola must be placed exactly inside the white area of the mask image provided");
    expect(p).not.toContain("inside the masked area");
  });

  it("senza maskHint non parla dell'immagine maschera", () => {
    expect(buildPrompt({ ...zenit, hasMask: false })).not.toContain("white area of the mask image");
    expect(buildPrompt({ ...zenit, hasMask: true })).not.toContain("white area of the mask image");
  });
});

describe("buildPrompt: posizione e riferimenti", () => {
  it("omette la sezione Position se il testo è vuoto o solo spazi", () => {
    expect(buildPrompt({ ...zenit, positionText: "" })).not.toContain("Position");
    expect(buildPrompt({ ...zenit, positionText: "   \n " })).not.toContain("Position");
  });

  it("attribuisce la posizione al personale commerciale", () => {
    const p = buildPrompt(zenit);
    expect(p).toContain('Position, as described by the sales staff (in Italian): "addossata alla parete a destra"');
    expect(p).not.toContain("customer");
  });

  it("con 1 riferimento usa il singolare", () => {
    const p = buildPrompt({ ...zenit, referenceCount: 1 });
    expect(p).toContain("1 reference image follows the photo");
    expect(p).not.toContain("1 reference images");
    expect(p).toContain("Reproduce the product exactly as shown in the reference images");
  });

  it("senza riferimenti chiede fedeltà alla descrizione tecnica e non cita immagini", () => {
    const p = buildPrompt({ ...zenit, referenceCount: 0 });
    expect(p).not.toContain("reference image");
    expect(p).not.toContain("Reproduce the product exactly as shown in the reference images");
    expect(p).toContain("technical description");
  });
});

describe("buildPrompt: regole emerse dalle prove sul campo", () => {
  it("apre con le regole critiche: inquadratura invariata e pergola interamente visibile", () => {
    const p = buildPrompt(zenit);
    expect(p).toContain("do not zoom, crop, shift or rescale");
    expect(p).toContain("must be completely visible");
    // le regole stanno subito dopo il compito, prima della descrizione del prodotto
    expect(p.indexOf("must be completely visible")).toBeLessThan(p.indexOf("Product:"));
    expect(buildPrompt({ ...zenit, hasMask: false })).toContain("do not zoom, crop, shift or rescale");
  });

  it("con i riferimenti vieta di copiarne edifici, arredi e sfondo", () => {
    const p = buildPrompt(zenit);
    expect(p).toContain("only for the design of the pergola");
    expect(p).toContain("do not copy any building, furniture, people or background");
    const none = buildPrompt({ ...zenit, referenceCount: 0 });
    expect(none).not.toContain("only for the design of the pergola");
  });

  it("esprime le proporzioni in modo relativo (larghezza : profondità : altezza libera)", () => {
    const p = buildPrompt(zenit);
    expect(p).toContain("width : depth : clear height = 4200 : 3800 : 2400");
    expect(p).toContain("1.75 : 1.58 : 1");
  });
});
