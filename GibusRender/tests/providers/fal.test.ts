import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { falProvider, falPollConfig } from "@/lib/providers/fal";
import { ProviderError } from "@/lib/providers/types";
import { PLACEMENT_HINT } from "@/lib/render/prompt";
import { jsonResponse, leftHalfMask, png } from "./helpers";

const fetchMock = vi.fn();
const OUT = Buffer.from("immagine-fal");
const SUBMIT = "https://queue.fal.run/fal-ai/nano-banana-pro/edit";
const STATUS = "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-1/status";
const RESULT = "https://queue.fal.run/fal-ai/nano-banana-pro/requests/req-1";
const IMAGE = "https://v3.fal.media/files/abc/out.png";

type Call = { url: string; init: RequestInit };
let calls: Call[];
let statuses: unknown[];
let resultResponse: () => Response;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("FAL_KEY", "fal-key-finta:segreto");
  falPollConfig.intervalMs = 0;
  falPollConfig.timeoutMs = 5_000;
  calls = [];
  statuses = [{ status: "COMPLETED" }];
  resultResponse = () => jsonResponse({ images: [{ url: IMAGE, content_type: "image/png" }], description: "" });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.startsWith("https://queue.fal.run/") && init.method === "POST") {
      const model = url.replace("https://queue.fal.run/", "");
      const app = model.split("/").slice(0, 2).join("/");
      return jsonResponse({
        request_id: "req-1",
        status_url: `https://queue.fal.run/${app}/requests/req-1/status`,
        response_url: `https://queue.fal.run/${app}/requests/req-1`,
      });
    }
    if (url.endsWith("/status")) {
      const s = statuses.length > 1 ? statuses.shift() : statuses[0];
      return jsonResponse(s);
    }
    if (url.startsWith("https://queue.fal.run/")) return resultResponse();
    if (url === IMAGE) return new Response(OUT, { status: 200, headers: { "content-type": "image/png" } });
    throw new Error(`fetch inatteso: ${url}`);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

type Extra = { mask?: Buffer; model?: string; quality?: "low" | "medium" | "high"; prompt?: string };

async function call(extra: Extra = {}) {
  const photo = await png(1248, 832);
  const refs = [await png(32, 32, [255, 0, 0])];
  const result = await falProvider.generate({
    photo,
    references: refs,
    prompt: "metti una pergola",
    model: "fal-ai/nano-banana-pro/edit",
    quality: "high",
    ...extra,
  });
  const submit = calls.find((c) => c.init.method === "POST")!;
  const body = JSON.parse(submit.init.body as string);
  return { result, calls, submit, body, photo, refs };
}

const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

describe("falProvider", () => {
  it("è il fornitore 'fal' e non applica la maschera in modo vincolante", () => {
    expect(falProvider.id).toBe("fal");
    expect(falProvider.label).toBe("fal.ai");
    expect(falProvider.supportsMask).toBe(false);
    expect(falProvider.suggestedModels[0]).toBe("fal-ai/nano-banana-pro/edit");
  });

  it("invia alla coda, controlla lo stato, legge il risultato e scarica l'immagine", async () => {
    const { result, calls, submit, body, photo, refs } = await call();
    expect(submit.url).toBe(SUBMIT);
    const h = new Headers(submit.init.headers);
    expect(h.get("authorization")).toBe("Key fal-key-finta:segreto");
    expect(submit.init.signal).toBeInstanceOf(AbortSignal);
    expect(body.prompt).toContain("metti una pergola");
    expect(body.image_urls).toEqual([dataUrl(photo), dataUrl(refs[0])]);
    expect(body.num_images).toBe(1);
    expect(body.output_format).toBe("png");
    expect(body.aspect_ratio).toBe("3:2");
    expect(body.resolution).toBe("2K");
    // sequenza: submit → status → result → download; la chiave non finisce negli URL
    expect(calls.map((c) => c.url)).toEqual([SUBMIT, STATUS, RESULT, IMAGE]);
    expect(calls.every((c) => !c.url.includes("segreto"))).toBe(true);
    expect(result.equals(OUT)).toBe(true);
  });

  it("l'immagine scaricata non riceve l'header di autorizzazione", async () => {
    const { calls } = await call();
    const dl = calls.find((c) => c.url === IMAGE)!;
    expect(new Headers(dl.init.headers).get("authorization")).toBeNull();
  });

  it("con la maschera la mette come seconda immagine e lo dice nel testo", async () => {
    const mask = await leftHalfMask(1248, 832);
    const { body, refs } = await call({ mask });
    expect(body.image_urls).toHaveLength(3);
    expect(body.image_urls[1]).toBe(dataUrl(mask));
    expect(body.image_urls[2]).toBe(dataUrl(refs[0]));
    expect(body.prompt).toContain("The second image is a mask: white = area to edit");
  });

  it("con qualità 'low' chiede 1K; i modelli senza 'pro' non ricevono resolution", async () => {
    expect((await call({ quality: "low" })).body.resolution).toBe("1K");
    calls.length = 0;
    const { body, submit } = await call({ model: "fal-ai/nano-banana/edit" });
    expect(submit.url).toBe("https://queue.fal.run/fal-ai/nano-banana/edit");
    expect(body.resolution).toBeUndefined();
    expect(body.aspect_ratio).toBe("3:2");
  });

  it("per i modelli gpt-image passa image_size e quality, non aspect_ratio", async () => {
    const { body } = await call({ model: "fal-ai/gpt-image-1.5/edit", quality: "medium" });
    expect(body.image_size).toBe("1536x1024");
    expect(body.quality).toBe("medium");
    expect(body.aspect_ratio).toBeUndefined();
    expect(body.resolution).toBeUndefined();
  });

  it("per FLUX Kontext multi passa image_urls e solo i rapporti d'aspetto supportati", async () => {
    const { submit, body, photo, refs } = await call({ model: "fal-ai/flux-pro/kontext/multi" });
    expect(submit.url).toBe("https://queue.fal.run/fal-ai/flux-pro/kontext/multi");
    expect(body.image_urls).toEqual([dataUrl(photo), dataUrl(refs[0])]);
    expect(body.aspect_ratio).toBe("3:2");
    expect(body.output_format).toBe("png");
    expect(body.resolution).toBeUndefined();
    expect(body.quality).toBeUndefined();
    expect(body.image_size).toBeUndefined();

    // 5:4 (1152x896) non è tra i rapporti di Kontext: si omette e il modello sceglie da solo
    calls.length = 0;
    const photo54 = await png(1152, 896);
    await falProvider.generate({
      photo: photo54,
      references: [],
      prompt: "x",
      model: "fal-ai/flux-pro/kontext/multi",
      quality: "high",
    });
    const sent = JSON.parse(calls.find((c) => c.init.method === "POST")!.init.body as string);
    expect(sent.aspect_ratio).toBeUndefined();
  });

  it("Kontext non riceve la maschera (la disegnerebbe nel risultato) né la frase che la nomina", async () => {
    const mask = await leftHalfMask(1248, 832);
    const prompt = `Task: x.\n\n${PLACEMENT_HINT}\n\nPosition: "sul prato".`;
    const { body, photo, refs } = await call({ model: "fal-ai/flux-pro/kontext/multi", mask, prompt });
    expect(body.image_urls).toEqual([dataUrl(photo), dataUrl(refs[0])]);
    expect(body.prompt).not.toContain(PLACEMENT_HINT);
    expect(body.prompt).not.toContain("mask");
    expect(body.prompt).toContain('Position: "sul prato"');

    // gli altri modelli la ricevono, con la frase di posizione intatta
    calls.length = 0;
    const other = await call({ model: "fal-ai/nano-banana-pro/edit", mask, prompt });
    expect(other.body.image_urls[1]).toBe(dataUrl(mask));
    expect(other.body.prompt).toContain(PLACEMENT_HINT);
  });

  it("Kontext accetta al massimo 4 immagini: i riferimenti in eccesso si tagliano in ordine", async () => {
    const photo = await png(1248, 832);
    const refs = [await png(32, 32, [255, 0, 0]), await png(32, 32, [0, 255, 0]), await png(32, 32, [0, 0, 255]), await png(32, 32)];
    await falProvider.generate({ photo, references: refs, prompt: "x", model: "fal-ai/flux-pro/kontext/multi", quality: "high" });
    const sent = JSON.parse(calls.find((c) => c.init.method === "POST")!.init.body as string);
    expect(sent.image_urls).toEqual([dataUrl(photo), dataUrl(refs[0]), dataUrl(refs[1]), dataUrl(refs[2])]);
    // i modelli senza tetto ricevono tutti i riferimenti
    calls.length = 0;
    await falProvider.generate({ photo, references: refs, prompt: "x", model: "fal-ai/nano-banana-pro/edit", quality: "high" });
    const all = JSON.parse(calls.find((c) => c.init.method === "POST")!.init.body as string);
    expect(all.image_urls).toHaveLength(5);
  });

  it("Nano Banana 2: aspect_ratio e resolution 1K (2K solo con qualità alta)", async () => {
    const m = "fal-ai/nano-banana-2/edit";
    const low = await call({ model: m, quality: "low" });
    expect(low.submit.url).toBe(`https://queue.fal.run/${m}`);
    expect(low.body.aspect_ratio).toBe("3:2");
    expect(low.body.resolution).toBe("1K");
    calls.length = 0;
    expect((await call({ model: m, quality: "medium" })).body.resolution).toBe("1K");
    calls.length = 0;
    expect((await call({ model: m, quality: "high" })).body.resolution).toBe("2K");
  });

  it("Nano Banana Lite: solo aspect_ratio (uscita fissa a 1K)", async () => {
    const { body } = await call({ model: "google/nano-banana-lite/edit" });
    expect(body.aspect_ratio).toBe("3:2");
    expect(body.resolution).toBeUndefined();
    expect(body.quality).toBeUndefined();
  });

  it("FLUX.3 Klein: nessun aspect_ratio né resolution, prompt non riscritto, fino a 10 immagini", async () => {
    const photo = await png(1248, 832);
    const refs = Array.from({ length: 12 }, (_, i) => png(32, 32, [i * 10, 0, 0]));
    const resolved = await Promise.all(refs);
    await falProvider.generate({
      photo,
      references: resolved,
      prompt: "x",
      model: "blackforestlabs/flux-3/klein/edit-image",
      quality: "high",
    });
    const sent = JSON.parse(calls.find((c) => c.init.method === "POST")!.init.body as string);
    expect(calls.find((c) => c.init.method === "POST")!.url).toBe("https://queue.fal.run/blackforestlabs/flux-3/klein/edit-image");
    expect(sent.aspect_ratio).toBeUndefined();
    expect(sent.resolution).toBeUndefined();
    expect(sent.enable_prompt_expansion).toBe(false);
    expect(sent.image_urls).toHaveLength(10);
    expect(sent.image_urls[0]).toBe(dataUrl(photo));
  });

  it("continua a controllare lo stato finché la richiesta non è completata", async () => {
    statuses = [{ status: "IN_QUEUE", queue_position: 2 }, { status: "IN_PROGRESS" }, { status: "COMPLETED" }];
    const { calls } = await call();
    expect(calls.filter((c) => c.url === STATUS)).toHaveLength(3);
  });

  it("se non finisce entro il tempo massimo è un errore 'timeout'", async () => {
    statuses = [{ status: "IN_PROGRESS" }];
    falPollConfig.intervalMs = 1;
    falPollConfig.timeoutMs = 20;
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("timeout");
  });

  it("saldo esaurito (403) diventa 'quota'", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ detail: "User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing." }, 403),
    );
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("quota");
    expect(err.message).not.toContain("segreto");
  });

  it("chiave non valida (401) diventa 'config' senza riportare la chiave", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ detail: "Invalid credentials" }, 401));
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("config");
    expect(err.message).not.toContain("segreto");
  });

  it("troppe richieste (429) diventa 'quota'", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ detail: "Too many requests" }, 429));
    expect((await call().catch((e) => e)).kind).toBe("quota");
  });

  it("violazione delle policy sui contenuti diventa 'rejected'", async () => {
    resultResponse = () =>
      jsonResponse({ detail: [{ type: "content_policy_violation", msg: "The content could not be processed" }] }, 422);
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("rejected");

    statuses = [{ status: "COMPLETED", error: "blocked", error_type: "content_policy_violation" }];
    expect((await call().catch((e) => e)).kind).toBe("rejected");
  });

  it("errore di validazione (422) diventa 'upstream' con il dettaglio", async () => {
    resultResponse = () => jsonResponse({ detail: [{ type: "value_error", msg: "image_urls too large" }] }, 422);
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.message).toContain("image_urls too large");
  });

  it("una risposta senza immagini diventa 'upstream'", async () => {
    resultResponse = () => jsonResponse({ images: [], description: "no" });
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("upstream");
    expect(err.message).toBe("Il modello non ha restituito un'immagine");
  });

  it("senza FAL_KEY non è configurato e generate lancia 'config'", async () => {
    vi.stubEnv("FAL_KEY", "");
    expect(falProvider.isConfigured()).toBe(false);
    const err = await call().catch((e) => e);
    expect(err.kind).toBe("config");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
