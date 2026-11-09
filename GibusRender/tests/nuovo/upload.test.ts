import { describe, expect, it } from "vitest";
import { computeUploadSize, nextJpegQuality, UPLOAD_TARGET_BYTES } from "@/app/nuovo/upload";

describe("computeUploadSize", () => {
  it("riduce il lato lungo a 3000 px mantenendo le proporzioni (orizzontale)", () => {
    expect(computeUploadSize(4032, 3024)).toEqual({ width: 3000, height: 2250 });
  });
  it("lascia invariate le foto già entro il limite", () => {
    expect(computeUploadSize(2000, 1000)).toEqual({ width: 2000, height: 1000 });
  });
  it("riduce il lato lungo anche in verticale", () => {
    expect(computeUploadSize(3024, 4032)).toEqual({ width: 2250, height: 3000 });
  });
  it("rispetta un maxSide diverso e non scende sotto 1 px", () => {
    expect(computeUploadSize(6000, 4000, 1500)).toEqual({ width: 1500, height: 1000 });
    expect(computeUploadSize(10000, 1, 3000)).toEqual({ width: 3000, height: 1 });
  });
});

describe("nextJpegQuality", () => {
  const MB = 1024 * 1024;
  it("il limite è 3,8 MB", () => {
    expect(UPLOAD_TARGET_BYTES).toBe(Math.floor(3.8 * MB));
  });
  it("sotto il limite non serve un altro tentativo", () => {
    expect(nextJpegQuality(2 * MB, 0.9)).toBeNull();
    expect(nextJpegQuality(UPLOAD_TARGET_BYTES - 1, 0.9)).toBeNull();
  });
  it("al limite o sopra scende di un gradino: 0.9 → 0.85 → 0.8 → 0.75", () => {
    expect(nextJpegQuality(UPLOAD_TARGET_BYTES, 0.9)).toBe(0.85);
    expect(nextJpegQuality(5 * MB, 0.85)).toBe(0.8);
    expect(nextJpegQuality(5 * MB, 0.8)).toBe(0.75);
  });
  it("a 0.75 si ferma (il server risponderà 413 se ancora troppo grande)", () => {
    expect(nextJpegQuality(5 * MB, 0.75)).toBeNull();
  });
});
