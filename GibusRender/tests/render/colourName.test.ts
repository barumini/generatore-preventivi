import { describe, expect, it } from "vitest";
import { colourName, normalizeHex } from "@/lib/render/colourName";

describe("normalizeHex", () => {
  it("accetta #RRGGBB e RRGGBB, in maiuscolo", () => {
    expect(normalizeHex("#f1ece1")).toBe("#F1ECE1");
    expect(normalizeHex(" 383e42 ")).toBe("#383E42");
  });

  it("scarta valori vuoti o non validi", () => {
    for (const v of [null, undefined, "", "#FFF", "#GGGGGG", "rosso"]) expect(normalizeHex(v)).toBeNull();
  });
});

describe("colourName: parola inglese del colore dal codice esadecimale", () => {
  it("riconosce i colori dei campioni Gibus usati nelle prove", () => {
    expect(colourName("#F1ECE1")).toBe("white"); // Bianco puro RAL 9010
    expect(colourName("#383E42")).toBe("anthracite grey"); // Antracite RAL 7016
  });

  it("divide i neutri per luminosità", () => {
    expect(colourName("#FFFFFF")).toBe("white");
    expect(colourName("#C8C8C8")).toBe("light grey");
    expect(colourName("#8F8F8F")).toBe("grey");
    expect(colourName("#0A0A0A")).toBe("black");
  });

  it("dà un nome ai colori con tinta", () => {
    expect(colourName("#E6D2B5")).toBe("beige");
    expect(colourName("#8B5A2B")).toBe("brown");
    expect(colourName("#3B2414")).toBe("dark brown");
    expect(colourName("#B22222")).toBe("red");
    expect(colourName("#2E5E3A")).toBe("green");
    expect(colourName("#1F3A93")).toBe("blue");
    expect(colourName("#A8C8F0")).toBe("light blue");
  });

  it("senza un codice valido non inventa nulla", () => {
    expect(colourName(null)).toBeNull();
    expect(colourName("rosso")).toBeNull();
  });
});
