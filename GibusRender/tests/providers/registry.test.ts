import { describe, expect, it } from "vitest";
import { disabledProviderMessage, getProvider, listProviders } from "@/lib/providers/registry";

describe("registry", () => {
  it("elenca i fornitori nell'ordine previsto", () => {
    expect(listProviders().map((p) => p.id)).toEqual(["openai", "openrouter", "gemini", "fal"]);
  });
  it("restituisce un fornitore per id", () => {
    expect(getProvider("openrouter").id).toBe("openrouter");
  });
  it("lancia un errore per un id sconosciuto", () => {
    expect(() => getProvider("x")).toThrow();
  });
});

describe("disabledProviderMessage", () => {
  it("null se il fornitore è abilitato, messaggio con l'etichetta se disabilitato", () => {
    expect(disabledProviderMessage("openai", ["openai", "openrouter"])).toBeNull();
    expect(disabledProviderMessage("openrouter", ["openai"])).toBe(
      "Fornitore OpenRouter disabilitato nelle impostazioni: duplica il render e scegli un altro fornitore",
    );
  });
});
