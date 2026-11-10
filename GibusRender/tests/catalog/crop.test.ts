import { describe, expect, it } from "vitest";
import { cropOutputSize, cropRectFromPoints, MIN_CROP_PX } from "@/lib/catalog/crop";

describe("cropRectFromPoints", () => {
  it("normalizza il rettangolo qualunque sia la direzione del trascinamento", () => {
    const expected = { left: 10, top: 20, width: 100, height: 60 };
    expect(cropRectFromPoints({ x: 10, y: 20 }, { x: 110, y: 80 }, 200, 100)).toEqual(expected);
    expect(cropRectFromPoints({ x: 110, y: 80 }, { x: 10, y: 20 }, 200, 100)).toEqual(expected);
    expect(cropRectFromPoints({ x: 110, y: 20 }, { x: 10, y: 80 }, 200, 100)).toEqual(expected);
  });

  it("limita il rettangolo ai bordi dell'immagine", () => {
    expect(cropRectFromPoints({ x: -5, y: -5 }, { x: 300, y: 150 }, 200, 100)).toEqual({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    });
  });

  it("arrotonda a pixel interi", () => {
    expect(cropRectFromPoints({ x: 10.4, y: 20.6 }, { x: 110.2, y: 80.4 }, 200, 100)).toEqual({
      left: 10,
      top: 21,
      width: 100,
      height: 59,
    });
  });

  it(`restituisce null se un lato è sotto i ${MIN_CROP_PX} px (un clic non è un ritaglio)`, () => {
    expect(cropRectFromPoints({ x: 50, y: 50 }, { x: 52, y: 90 }, 200, 100)).toBeNull();
    expect(cropRectFromPoints({ x: 50, y: 50 }, { x: 50, y: 50 }, 200, 100)).toBeNull();
  });
});

describe("cropOutputSize", () => {
  it("non ingrandisce e porta il lato lungo al massimo mantenendo le proporzioni", () => {
    expect(cropOutputSize(1000, 500)).toEqual({ width: 1000, height: 500 });
    expect(cropOutputSize(4000, 1000)).toEqual({ width: 2000, height: 500 });
    expect(cropOutputSize(1000, 3000, 1500)).toEqual({ width: 500, height: 1500 });
  });
});
