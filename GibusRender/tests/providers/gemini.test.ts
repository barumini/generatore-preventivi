import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiProvider } from "@/lib/providers/gemini";
import { ProviderError } from "@/lib/providers/types";
import { jsonResponse, leftHalfMask, png } from "./helpers";

const fetchMock = vi.fn();
const OUT = Buffer.from("immagine-gemini");

type Part = { text?: string; inline_data?: { mime_type: string; data: string } };

const okBody = {
  candidates: [
    {
      content: {
        parts: [{ text: "Ecco la pergola" }, { inlineData: { mimeType: "image/png", data: OUT.toString("base64") } }],
      },
      finishReason: "STOP",
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chiave-gemini-finta");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => jsonResponse(okBody));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function call(extra: { mask?: Buffer; model?: string; quality?: "low" | "medium" | "high" } = {}) {
  const photo = await png(1248, 832);
  const refs = [await png(32, 32, [255, 0, 0])];
  const result = await geminiProvider.generate({
    photo,
    references: refs,
    prompt: "metti una pergola",
    model: "gemini-3-pro-image",
    quality: "high",
    ...extra,
  });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  const parts = body.contents[0].parts as Part[];
  return { result, url, init, body, parts, photo, refs };
}

const b64 = (b: Buffer) => b.toString("base64");

describe("geminiProvider", () => {
  it("è il fornitore 'gemini' e non applica la maschera in modo vincolante", () => {
    expect(geminiProvider.id).toBe("gemini");
    expect(geminiProvider.label).toBe("Google Gemini");
    expect(geminiProvider.supportsMask).toBe(false);
    expect(geminiProvider.suggestedModels[0]).toBe("gemini-3-pro-image");
  });

  it("chiama generateContent con la chiave nell'header e testo + foto + riferimenti", async () => {
    const { result, url, init, body, parts, photo, refs } = await call();
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent");
    expect(init.method).toBe("POST");
    const h = new Headers(init.headers);
    expect(h.get("x-goog-api-key")).toBe("chiave-gemini-finta");
    expect(url).not.toContain("chiave-gemini-finta");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(body.contents[0].role).toBe("user");
    expect(parts[0].text).toContain("metti una pergola");
    expect(parts[0].text).not.toContain("mask");
    expect(parts[1].inline_data).toEqual({ mime_type: "image/png", data: b64(photo) });
    expect(parts[2].inline_data).toEqual({ mime_type: "image/png", data: b64(refs[0]) });
    expect(parts).toHaveLength(3);
    expect(body.generationConfig.responseModalities).toEqual(["TEXT", "IMAGE"]);
    expect(result.equals(OUT)).toBe(true);
  });

  it("con la maschera la mette come seconda immagine e lo dice nel testo", async () => {
    const mask = await leftHalfMask(1248, 832);
    const { parts, refs } = await call({ mask });
    expect(parts).toHaveLength(4);
    expect(parts[0].text).toContain("The second image is a mask: white = area to edit");
    expect(parts[2].inline_data!.data).toBe(b64(mask));
    expect(parts[3].inline_data!.data).toBe(b64(refs[0]));
  });

  it("chiede il rapporto d'aspetto della foto e, per i modelli Gemini 3, la risoluzione 2K", async () => {
    const { body } = await call();
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: "3:2", imageSize: "2K" });
  });

  it("con qualità 'low' chiede 1K; i modelli 2.5 non ricevono imageSize", async () => {
    expect((await call({ quality: "low" })).body.generationConfig.imageConfig.imageSize).toBe("1K");
    fetchMock.mockClear();
    const { body } = await call({ model: "gemini-2.5-flash-image" });
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: "3:2" });
  });

  it("un blocco di sicurezza diventa ProviderError 'rejected'", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ promptFeedback: { blockReason: "SAFETY" } }));
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("rejected");

    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] }));
    expect((await call().catch((e) => e)).kind).toBe("rejected");
  });

  it("una risposta senza immagine diventa 'upstream'", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: "No" }] } }] }));
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.message).toBe("Il modello non ha restituito un'immagine");
  });

  it("una chiave non valida (400 API_KEY_INVALID) diventa 'config' senza riportare la chiave", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 400,
            message: "API key not valid. Please pass a valid API key.",
            status: "INVALID_ARGUMENT",
            details: [{ reason: "API_KEY_INVALID" }],
          },
        },
        400,
      ),
    );
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("config");
    expect(err.message).not.toContain("chiave-gemini-finta");
  });

  it("senza GEMINI_API_KEY non è configurato e generate lancia 'config'", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(geminiProvider.isConfigured()).toBe(false);
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("config");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quota esaurita (429) o credito finito (402) diventano 'quota'", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: { code: 429, message: "You exceeded your current quota", status: "RESOURCE_EXHAUSTED" } }, 429),
    );
    expect((await call().catch((e) => e)).kind).toBe("quota");
    fetchMock.mockImplementation(async () => jsonResponse({ error: { message: "Insufficient credits" } }, 402));
    expect((await call().catch((e) => e)).kind).toBe("quota");
  });
});
