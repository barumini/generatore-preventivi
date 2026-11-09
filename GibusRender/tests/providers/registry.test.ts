import { describe, expect, it } from "vitest";
import { getProvider, listProviders } from "@/lib/providers/registry";

describe("registry", () => {
  it("elenca i fornitori nell'ordine previsto", () => {
    expect(listProviders().map((p) => p.id)).toEqual(["openai", "openrouter"]);
  });
  it("restituisce un fornitore per id", () => {
    expect(getProvider("openrouter").id).toBe("openrouter");
  });
  it("lancia un errore per un id sconosciuto", () => {
    expect(() => getProvider("x")).toThrow();
  });
});
