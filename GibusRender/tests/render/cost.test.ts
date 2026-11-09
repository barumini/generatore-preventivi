import { describe, expect, it } from "vitest";
import { estimateCost, USD_EUR } from "@/lib/render/cost";

describe("estimateCost", () => {
  it("dà un importo positivo per gpt-image-1 high × 3", () => {
    const c = estimateCost("openai", "gpt-image-1", "high", 3);
    expect(c).not.toBeNull();
    expect(c!.eur).toBeGreaterThan(0);
  });

  it("restituisce null per un modello sconosciuto", () => {
    expect(estimateCost("openrouter", "sconosciuto", "high", 3)).toBeNull();
    expect(estimateCost("altro", "gpt-image-1", "high", 3)).toBeNull();
  });

  it("scala con il numero di varianti e la qualità", () => {
    const one = estimateCost("openai", "gpt-image-2", "high", 1)!.eur;
    expect(estimateCost("openai", "gpt-image-2", "high", 3)!.eur).toBeCloseTo(one * 3, 6);
    expect(estimateCost("openai", "gpt-image-2", "low", 1)!.eur).toBeLessThan(one);
  });

  it("converte da USD con il tasso fisso dichiarato", () => {
    expect(USD_EUR).toBe(0.92);
    // gemini-2.5-flash-image: 0,039 USD per immagine, indipendente dalla qualità.
    const c = estimateCost("openrouter", "google/gemini-2.5-flash-image", "low", 2)!;
    expect(c.eur).toBeCloseTo(0.039 * 2 * 0.92, 6);
    expect(estimateCost("openrouter", "google/gemini-2.5-flash-image", "high", 2)!.eur).toBeCloseTo(c.eur, 6);
  });

  it("restituisce null per una qualità sconosciuta su OpenAI", () => {
    expect(estimateCost("openai", "gpt-image-1", "ultra", 1)).toBeNull();
  });
});
