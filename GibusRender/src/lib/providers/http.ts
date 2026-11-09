import { ProviderError } from "./types";

/** Tempo massimo per una singola chiamata a un fornitore. */
export const PROVIDER_TIMEOUT_MS = 240_000;

/** fetch con timeout; gli errori di rete e il timeout diventano ProviderError. */
export async function providerFetch(label: string, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new ProviderError("timeout", `${label}: tempo scaduto (oltre ${PROVIDER_TIMEOUT_MS / 1000} s)`, { cause: e });
    }
    throw new ProviderError("upstream", `${label}: impossibile contattare il servizio`, { cause: e });
  }
}

/** Legge il corpo come JSON, senza lanciare se non lo è. */
export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

/** Estrae codice e messaggio d'errore da una risposta in stile OpenAI. */
export function errorInfo(body: unknown): { code: string; message: string } {
  const err = (body as { error?: { code?: unknown; message?: unknown; type?: unknown } })?.error;
  const code = [err?.code, err?.type].filter((v) => typeof v === "string" || typeof v === "number").join(" ");
  const message = typeof err?.message === "string" ? err.message : "";
  return { code: String(code), message };
}

const MODERATION = /moderation|safety|content.?policy|flagged/i;

/** Traduce una risposta HTTP non riuscita in ProviderError. */
export function httpError(label: string, status: number, body: unknown): ProviderError {
  const { code, message } = errorInfo(body);
  const detail = message ? `: ${message}` : "";
  if ((status === 400 || status === 403) && MODERATION.test(`${code} ${message}`)) {
    return new ProviderError("rejected", `${label}: richiesta rifiutata dal filtro di sicurezza del fornitore${detail}`);
  }
  if (status === 401) return new ProviderError("config", `${label}: chiave API non valida o revocata`);
  if (status === 402) return new ProviderError("upstream", `${label}: credito esaurito${detail}`);
  if (status === 429) return new ProviderError("upstream", `${label}: troppe richieste o quota superata${detail}`);
  return new ProviderError("upstream", `${label}: errore ${status}${detail}`);
}
