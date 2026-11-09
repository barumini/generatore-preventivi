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
