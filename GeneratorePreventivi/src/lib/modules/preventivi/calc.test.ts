import { describe, it, expect } from "vitest";
import { parseNum, fmt, computeTotals } from "./calc";

describe("parseNum", () => {
  it("parses plain integers", () => {
    expect(parseNum("1500")).toBe(1500);
  });

  it("parses comma as decimal separator", () => {
    expect(parseNum("1500,50")).toBe(1500.5);
  });

  it("parses dot as thousands separator combined with comma decimal", () => {
    expect(parseNum("1.500,50")).toBe(1500.5);
  });

  it("parses dot as decimal separator when no comma present", () => {
    expect(parseNum("1500.50")).toBe(1500.5);
  });

  it("returns 0 for empty or garbage input", () => {
    expect(parseNum("")).toBe(0);
    expect(parseNum(null)).toBe(0);
    expect(parseNum(undefined)).toBe(0);
    expect(parseNum("abc")).toBe(0);
  });

  it("strips stray non-numeric characters", () => {
    expect(parseNum("€ 250")).toBe(250);
  });
});

describe("fmt", () => {
  it("formats with Italian thousands/decimal separators and € prefix", () => {
    expect(fmt(7750)).toBe("€ 7.750,00");
  });

  it("formats small values with two decimals", () => {
    expect(fmt(0)).toBe("€ 0,00");
    expect(fmt(1.5)).toBe("€ 1,50");
  });

  it("prefixes negatives with a minus sign", () => {
    expect(fmt(-250)).toBe("− € 250,00");
  });

  it("groups large numbers correctly", () => {
    expect(fmt(1234567.89)).toBe("€ 1.234.567,89");
  });
});

describe("computeTotals", () => {
  it("computes imponibile, sconto, subtotale, iva, totale", () => {
    const totals = computeTotals(
      [{ qty: "1", price: "7750" }],
      "50",
      "22"
    );
    expect(totals.imponibile).toBe(7750);
    expect(totals.scontoAmt).toBe(3875);
    expect(totals.subtotale).toBe(3875);
    expect(totals.ivaAmt).toBeCloseTo(852.5);
    expect(totals.totale).toBeCloseTo(4727.5);
  });

  it("sums multiple line items", () => {
    const totals = computeTotals(
      [
        { qty: "2", price: "100" },
        { qty: "1", price: "50" },
      ],
      "0",
      "22"
    );
    expect(totals.imponibile).toBe(250);
    expect(totals.scontoAmt).toBe(0);
    expect(totals.totale).toBeCloseTo(305);
  });

  it("treats missing/blank quantities and prices as zero", () => {
    const totals = computeTotals([{ qty: "", price: "" }], "50", "22");
    expect(totals.imponibile).toBe(0);
    expect(totals.totale).toBe(0);
  });
});
