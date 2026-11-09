import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { openaiProvider } from "@/lib/providers/openai";
import { ProviderError } from "@/lib/providers/types";
import { fileBytes, jsonResponse, leftHalfMask, png } from "./helpers";

const fetchMock = vi.fn();
const OUT = Buffer.from("immagine-generata");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "sk-test-finta");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ created: 1, data: [{ b64_json: OUT.toString("base64") }] }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function call(extra: { mask?: Buffer } = {}) {
  const photo = await png(1536, 1024);
  const refs = [await png(64, 64, [255, 0, 0]), await png(64, 64, [0, 255, 0])];
  const result = await openaiProvider.generate({
    photo,
    references: refs,
    prompt: "metti una pergola",
    model: "gpt-image-2",
    quality: "high",
    ...extra,
  });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { result, url, init, form: init.body as FormData, photo, refs };
}

describe("openaiProvider", () => {
  it("dichiara maschera e dimensioni supportate", () => {
    expect(openaiProvider.id).toBe("openai");
    expect(openaiProvider.supportsMask).toBe(true);
    expect(openaiProvider.supportedSizes).toEqual([
      { width: 1024, height: 1024 },
      { width: 1536, height: 1024 },
      { width: 1024, height: 1536 },
    ]);
  });

  it("invia multipart a /v1/images/edits con foto e riferimenti in image[]", async () => {
    const { result, url, init, form, photo, refs } = await call();
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-test-finta");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(form.get("model")).toBe("gpt-image-2");
    expect(form.get("quality")).toBe("high");
    expect(form.get("n")).toBe("1");
    expect(form.get("size")).toBe("1536x1024");
    expect(form.get("prompt")).toBe("metti una pergola");
    const images = form.getAll("image[]");
    expect(images).toHaveLength(3);
    expect((await fileBytes(images[0])).equals(photo)).toBe(true);
    expect((await fileBytes(images[1])).equals(refs[0])).toBe(true);
    expect((await fileBytes(images[2])).equals(refs[1])).toBe(true);
    expect(form.get("mask")).toBeNull();
    expect(result.equals(OUT)).toBe(true);
  });

  it("converte la maschera in PNG RGBA: alfa 0 dentro l'area da modificare, 255 fuori", async () => {
    const { form } = await call({ mask: await leftHalfMask(1536, 1024) });
    const mask = await fileBytes(form.get("mask"));
    const { data, info } = await sharp(mask).raw().toBuffer({ resolveWithObject: true });
    expect((await sharp(mask).metadata()).format).toBe("png");
    expect(info.channels).toBe(4);
    expect([info.width, info.height]).toEqual([1536, 1024]);
    const alpha = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    expect(alpha(10, 500)).toBe(0);
    expect(alpha(1500, 500)).toBe(255);
  });

  it("una risposta 400 di moderazione diventa ProviderError 'rejected'", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "moderation_blocked", message: "Your request was rejected by the safety system." } },
        400,
      ),
    );
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("rejected");
  });

  it("altri errori HTTP diventano 'upstream'", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: "boom" } }, 500));
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("upstream");
  });

  it("il timeout diventa ProviderError 'timeout'", async () => {
    fetchMock.mockRejectedValue(new DOMException("scaduto", "TimeoutError"));
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("timeout");
  });

  it("senza OPENAI_API_KEY non è configurato e generate lancia 'config'", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(openaiProvider.isConfigured()).toBe(false);
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("config");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
