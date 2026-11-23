import { describe, expect, it } from "vitest";
import { GUIDE_LEGEND, PLACEMENT_HINT, buildPrompt, promptVolume, type PromptInput } from "@/lib/render/prompt";

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

  // Prova reale del confronto: con riferimenti antracite e colore Bianco RAL 9010
  // la pergola usciva grigia, perché il prompt diceva di prendere il colore dai riferimenti.
  it("con una finitura scelta il colore viene dalle finiture, non dai riferimenti", () => {
    const p = buildPrompt({ ...zenit, color: { name: "Bianco puro RAL 9010", code: "RAL 9010" } });
    expect(p).not.toContain("louvres, colour)");
    expect(p).toContain("the colours are the ones given under Finishes");
    expect(p).toContain("even where the reference images show a different colour");
    expect(p).toContain(
      "structure colour Bianco puro RAL 9010 (RAL 9010), matt textured powder coating: posts, beams and frame all in this colour",
    );
    const lamelle = buildPrompt({
      ...zenit,
      product: { ...zenit.product, coverType: "LAMELLE_ORIENTABILI" },
      fabric: undefined,
    });
    expect(lamelle).toContain("matt textured powder coating: posts, beams and louvres all in this colour");
  });

  // Seconda prova: il solo nome italiano e il codice RAL non bastavano, il bianco
  // usciva ancora grigio chiaro; con parola inglese ed esadecimale è uscito bianco.
  it("con il colore di anteprima descrive il colore in inglese con l'esadecimale", () => {
    const p = buildPrompt({
      ...zenit,
      product: { ...zenit.product, coverType: "LAMELLE_ORIENTABILI" },
      fabric: undefined,
      color: { name: "Bianco puro RAL 9010", code: "RAL 9010", swatchHex: "#f1ece1" },
    });
    expect(p).toContain(
      "structure colour white, Bianco puro RAL 9010 (RAL 9010, approximately #F1ECE1), matt textured powder coating: " +
        "posts, beams and louvres all in this white colour, not grey",
    );
    const antracite = buildPrompt({
      ...zenit,
      color: { name: "Antracite RAL 7016 sablé", code: "RAL 7016", swatchHex: "#383E42" },
    });
    expect(antracite).toContain(
      "structure colour anthracite grey, Antracite RAL 7016 sablé (RAL 7016, approximately #383E42)",
    );
    expect(antracite).toContain("all in this anthracite grey colour;");
    expect(antracite).not.toContain("not grey");
  });

  it("con un colore di anteprima non valido resta il solo nome", () => {
    const p = buildPrompt({ ...zenit, color: { name: "Bianco puro RAL 9010", code: "RAL 9010", swatchHex: "bianco" } });
    expect(p).toContain("structure colour Bianco puro RAL 9010 (RAL 9010), matt textured powder coating");
    expect(p).not.toContain("approximately");
  });

  it("vale anche con il solo tessuto", () => {
    const p = buildPrompt({ ...zenit, color: undefined });
    expect(p).toContain("the colours are the ones given under Finishes");
  });

  it("senza finiture il colore resta quello dei riferimenti", () => {
    const p = buildPrompt({ ...zenit, color: undefined, fabric: undefined });
    expect(p).toContain("only for the design of the pergola (posts, beams, louvres, colour)");
    expect(p).not.toContain("given under Finishes");
  });

  it("esprime le proporzioni in modo relativo (larghezza : profondità : altezza libera)", () => {
    const p = buildPrompt(zenit);
    expect(p).toContain("width : depth : clear height = 4200 : 3800 : 2400");
    expect(p).toContain("1.75 : 1.58 : 1");
  });
});

describe("buildPrompt con il volume 3D", () => {
  const volume: NonNullable<PromptInput["volume"]> = {
    wallHeightMm: 2800,
    frontHeightMm: 2500,
    distanceMm: 0,
    wallLine: [
      { x: 0.161, y: 0.344 },
      { x: 0.69, y: 0.36 },
    ],
    frontEdge: [
      { x: 0.1, y: 0.31 },
      { x: 0.75, y: 0.342 },
    ],
    posts: [
      { foot: { x: 0.1, y: 0.68 }, head: { x: 0.1, y: 0.31 }, xMm: 0, rear: false },
      { foot: { x: 0.75, y: 0.62 }, head: { x: 0.75, y: 0.342 }, xMm: 4200, rear: false },
    ],
    guideImage: true,
  };
  const withVolume: PromptInput = {
    ...zenit,
    hasMask: false,
    maskHint: true,
    scale: { lengthMm: 2100, pixelLength: 300, photoWidth: 1200 },
    volume,
  };

  it("sostituisce l'indicazione generica e la scala con le posizioni esatte", () => {
    const p = buildPrompt(withVolume);
    expect(p).not.toContain(PLACEMENT_HINT);
    expect(p).not.toContain("Reference for scale");
    expect(p).toContain("Placement (exact):");
    expect(p).toContain("from (16%, 34%) to (69%, 36%)");
    expect(p).toContain("2 front posts");
    expect(p).toContain("foot at (10%, 68%), top at (10%, 31%), 0 mm from the left end");
    expect(p).toContain("foot at (75%, 62%), top at (75%, 34%), 4200 mm from the left end");
    expect(p).toContain("front edge of the roof runs from (10%, 31%) to (75%, 34%)");
  });

  it("riporta altezza al muro e altezza sul fronte al posto dell'altezza totale", () => {
    const p = buildPrompt(withVolume);
    expect(p).toContain("height at the wall 2800 mm");
    expect(p).toContain("height at the front 2500 mm");
    expect(p).toContain("clear height under the beams 2400 mm");
    expect(p).not.toContain("total height");
  });

  it("spiega i colori della guida in un paragrafo a sé, solo se la guida viene inviata", () => {
    const p = buildPrompt(withVolume);
    expect(p.split("\n\n")).toContain(GUIDE_LEGEND);
    expect(buildPrompt({ ...withVolume, volume: { ...volume, guideImage: false } })).not.toContain(GUIDE_LEGEND);
    for (const s of ["red", "blue", "white dashed", "never draw them in the result"]) expect(GUIDE_LEGEND).toContain(s);
  });

  it("autoportante: niente attacco a muro, distanza dal muro e montanti posteriori", () => {
    const p = buildPrompt({
      ...withVolume,
      volume: {
        ...volume,
        distanceMm: 800,
        wallLine: null,
        posts: [...volume.posts, { foot: { x: 0.2, y: 0.6 }, head: { x: 0.2, y: 0.33 }, xMm: 0, rear: true }],
      },
    });
    expect(p).toContain("not attached to the wall");
    expect(p).toContain("800 mm");
    expect(p).toContain("1 rear post");
    expect(p).not.toContain("Wall attachment");
  });

  it("senza montanti lo dice esplicitamente", () => {
    expect(buildPrompt({ ...withVolume, volume: { ...volume, posts: [] } })).toContain("no posts");
  });

  it("promptVolume ricava i dati del prompt dal volume proiettato", () => {
    const pv = {
      vertices: Array.from({ length: 8 }, (_, i) => ({ x: i / 10, y: i / 20 })),
      posts: volume.posts,
      wallLine: volume.wallLine,
    };
    const box = { offsetXMm: 0, distanceMm: 0, wallHeightMm: 2800, frontHeightMm: 2500 };
    expect(promptVolume(box, pv)).toEqual({
      wallHeightMm: 2800,
      frontHeightMm: 2500,
      distanceMm: 0,
      wallLine: volume.wallLine,
      frontEdge: [pv.vertices[7], pv.vertices[6]],
      posts: volume.posts,
      guideImage: true,
    });
  });
});
