import { describe, expect, it } from "vitest";
import { dilationPx, validatePolygon } from "@/lib/render/geometry";

describe("validatePolygon", () => {
  it("rifiuta meno di 3 punti", () => {
    expect(validatePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual({
      ok: false,
      error: "La sagoma deve avere almeno 3 punti",
    });
  });

  it("riconduce le coordinate in [0,1]", () => {
    const r = validatePolygon([
      { x: -0.2, y: 1.3 },
      { x: 0.5, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.points[0]).toEqual({ x: 0, y: 1 });
  });

  it("rifiuta tre punti quasi allineati (area nulla)", () => {
    expect(
      validatePolygon([
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
        { x: 0.9, y: 0.9000001 },
      ]),
    ).toEqual({ ok: false, error: "La sagoma è troppo piccola" });
  });

  it("rifiuta un'area sotto lo 0,1% della foto", () => {
    const r = validatePolygon([
      { x: 0.5, y: 0.5 },
      { x: 0.53, y: 0.5 },
      { x: 0.5, y: 0.53 },
    ]); // area 0,045%
    expect(r).toEqual({ ok: false, error: "La sagoma è troppo piccola" });
  });
});

describe("dilationPx", () => {
  it("vale il 2% della diagonale, minimo 8 px", () => {
    expect(dilationPx(4000, 3000)).toBe(100);
    expect(dilationPx(200, 100)).toBe(8);
  });
});
