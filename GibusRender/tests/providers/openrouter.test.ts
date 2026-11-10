import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openrouterProvider, openrouterSuggestedModels } from "@/lib/providers/openrouter";
import { ProviderError } from "@/lib/providers/types";
import { jsonResponse, leftHalfMask, png } from "./helpers";

const fetchMock = vi.fn();
const OUT = Buffer.from("immagine-gemini");

type Part = { type: string; text?: string; image_url?: { url: string } };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test-finta");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    jsonResponse({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Ecco",
            images: [{ type: "image_url", image_url: { url: `data:image/png;base64,${OUT.toString("base64")}` } }],
          },
        },
      ],
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function call(extra: { mask?: Buffer } = {}) {
  const photo = await png(1248, 832);
  const refs = [await png(32, 32, [255, 0, 0])];
  const result = await openrouterProvider.generate({
    photo,
    references: refs,
    prompt: "metti una pergola",
    model: "google/gemini-2.5-flash-image",
    quality: "high",
    ...extra,
  });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  const parts = body.messages[0].content as Part[];
  return { result, url, init, body, parts, photo, refs };
}

const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

describe("openrouterProvider", () => {
  it("non supporta la maschera", () => {
    expect(openrouterProvider.id).toBe("openrouter");
    expect(openrouterProvider.supportsMask).toBe(false);
  });

  it("chiama chat/completions con modalities e testo + foto + riferimenti", async () => {
    const { result, url, init, body, parts, photo, refs } = await call();
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    const h = new Headers(init.headers);
    expect(h.get("authorization")).toBe("Bearer sk-or-test-finta");
    expect(h.get("x-title")).toBe("GibusRender");
    expect(h.get("http-referer")).toBeTruthy();
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(body.model).toBe("google/gemini-2.5-flash-image");
    expect(body.modalities).toEqual(["image", "text"]);
    expect(body.messages[0].role).toBe("user");
    expect(parts.map((p) => p.type)).toEqual(["text", "image_url", "image_url"]);
    expect(parts[0].text).toContain("metti una pergola");
    expect(parts[0].text).not.toContain("mask");
    expect(parts[1].image_url!.url).toBe(dataUrl(photo));
    expect(parts[2].image_url!.url).toBe(dataUrl(refs[0]));
    expect(result.equals(OUT)).toBe(true);
  });

  it("con la maschera la mette come seconda immagine e lo dice nel testo", async () => {
    const mask = await leftHalfMask(1248, 832);
    const { parts, refs } = await call({ mask });
    expect(parts.map((p) => p.type)).toEqual(["text", "image_url", "image_url", "image_url"]);
    expect(parts[0].text).toContain("The second image is a mask: white = area to edit");
    expect(parts[2].image_url!.url).toBe(dataUrl(mask));
    expect(parts[3].image_url!.url).toBe(dataUrl(refs[0]));
  });

  it("chiede il rapporto d'aspetto della foto quando è tra quelli supportati", async () => {
    const { body } = await call();
    expect(body.image_config).toEqual({ aspect_ratio: "3:2" });
  });

  it("una risposta senza immagini diventa ProviderError 'upstream'", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { role: "assistant", content: "No" } }] }));
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("upstream");
    expect(err.message).toBe("Il modello non ha restituito un'immagine");
  });

  it("il timeout diventa ProviderError 'timeout'", async () => {
    fetchMock.mockRejectedValue(new DOMException("scaduto", "TimeoutError"));
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("timeout");
  });

  it("senza OPENROUTER_API_KEY non è configurato e generate lancia 'config'", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(openrouterProvider.isConfigured()).toBe(false);
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("config");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("legge i modelli suggeriti da OPENROUTER_MODELS, con un predefinito", () => {
    vi.stubEnv("OPENROUTER_MODELS", "");
    expect(openrouterSuggestedModels()).toEqual(["google/gemini-2.5-flash-image"]);
    vi.stubEnv("OPENROUTER_MODELS", " a/b , c/d ,,");
    expect(openrouterSuggestedModels()).toEqual(["a/b", "c/d"]);
  });
});
