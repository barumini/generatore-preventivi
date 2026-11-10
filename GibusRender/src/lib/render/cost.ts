// Stima del costo di una generazione. Modulo puro, usabile anche lato browser.

/** Tasso di cambio costante USD → EUR usato per tutte le stime. */
export const USD_EUR = 0.92;

type Quality = "low" | "medium" | "high";

/*
 * Prezzi pubblici in USD per immagine in uscita (verificati il 2026-11-09).
 * Si considera il costo dell'immagine generata; i token in ingresso (testo,
 * foto e riferimenti) aggiungono qualche centesimo e non sono inclusi.
 * Per OpenAI si prende il valore più alto tra 1024×1024, 1024×1536 e
 * 1536×1024 (stima prudente: la dimensione dipende dalla foto).
 *
 * OpenAI — https://developers.openai.com/api/docs/guides/image-generation
 *   ("Historical output costs"), consultato il 2026-11-09.
 *   gpt-image-1 è stato spento il 23/10/2026: prezzi conservati solo come
 *   riferimento storico (https://developers.openai.com/api/docs/deprecations).
 *   gpt-image-2.5-* non ha un prezzo per immagine pubblicato (solo per token,
 *   con conteggio variabile): escluso, quindi "Stima non disponibile".
 */
const OPENAI: Record<string, Record<Quality, number>> = {
  "gpt-image-2": { low: 0.006, medium: 0.053, high: 0.211 },
  "gpt-image-1.5": { low: 0.013, medium: 0.05, high: 0.2 },
  "gpt-image-1": { low: 0.016, medium: 0.063, high: 0.25 },
  "gpt-image-1-mini": { low: 0.006, medium: 0.015, high: 0.052 },
};

/*
 * OpenRouter — prezzo per token immagine in uscita da
 *   https://openrouter.ai/api/v1/models?output_modalities=image (2026-11-09),
 *   moltiplicato per i token per immagine pubblicati da Google su
 *   https://ai.google.dev/gemini-api/docs/pricing (2026-11-09):
 *   - gemini-2.5-flash-image: 1290 token × 30 $/M = 0,039 $ (deprecato da
 *     Google, spegnimento previsto il 15/03/2027);
 *   - gemini-3.1-flash-image: 1120 token (1K) × 60 $/M = 0,067 $;
 *   - gemini-3-pro-image: 1120 token (1K–2K) × 120 $/M = 0,134 $.
 *   La qualità non influisce sul prezzo di questi modelli.
 */
const OPENROUTER: Record<string, number> = {
  "google/gemini-2.5-flash-image": 0.039,
  "google/gemini-3.1-flash-image": 0.067,
  "google/gemini-3.1-flash-image-preview": 0.067,
  "google/gemini-3-pro-image": 0.134,
  "google/gemini-3-pro-image-preview": 0.134,
};

/*
 * Google Gemini (API diretta) — https://ai.google.dev/gemini-api/docs/pricing
 *   (2026-11-09), stessi token per immagine e prezzi per token dei modelli
 *   via OpenRouter. L'app chiede al massimo 2K: per gemini-3-pro-image il
 *   prezzo 1K–2K è lo stesso (0,134 $); la qualità non cambia il prezzo.
 */
const GEMINI: Record<string, number> = {
  "gemini-2.5-flash-image": 0.039,
  "gemini-3.1-flash-image": 0.067,
  "gemini-3.1-flash-image-preview": 0.067,
  "gemini-3-pro-image": 0.134,
  "gemini-3-pro-image-preview": 0.134,
};

/*
 * fal.ai — prezzo per immagine in uscita, dalle pagine dei modelli su fal.ai
 *   (2026-11-10): nano-banana-pro/edit 0,15 $ (1K e 2K; 4K costa il doppio e
 *   l'app non lo chiede), gpt-image-1.5/edit a 1536×1024 (0,009 $ low solo a
 *   1024×1024; qui 0,013 / 0,050 / 0,199 $). I token in ingresso (foto e
 *   riferimenti) si pagano a parte e non sono inclusi.
 *   nano-banana/edit: prezzo non pubblicato sulla pagina del modello, escluso.
 */
const FAL: Record<string, number | Record<Quality, number>> = {
  "fal-ai/nano-banana-pro/edit": 0.15,
  "fal-ai/gpt-image-1.5/edit": { low: 0.013, medium: 0.05, high: 0.199 },
};

function usdPerImage(providerId: string, model: string, quality: string): number | null {
  if (providerId === "openai") {
    const row = Object.hasOwn(OPENAI, model) ? OPENAI[model] : undefined;
    if (!row || !Object.hasOwn(row, quality)) return null;
    return row[quality as Quality];
  }
  if (providerId === "openrouter") return Object.hasOwn(OPENROUTER, model) ? OPENROUTER[model] : null;
  if (providerId === "fal") {
    const p = Object.hasOwn(FAL, model) ? FAL[model] : undefined;
    if (p === undefined) return null;
    if (typeof p === "number") return p;
    return Object.hasOwn(p, quality) ? p[quality as Quality] : null;
  }
  if (providerId === "gemini") return Object.hasOwn(GEMINI, model) ? GEMINI[model] : null;
  return null;
}

/** Costo stimato in EUR per `variants` immagini; null se il modello non è in tabella. */
export function estimateCost(
  providerId: string,
  model: string,
  quality: string,
  variants: number,
): { eur: number } | null {
  const usd = usdPerImage(providerId, model, quality);
  if (usd === null) return null;
  return { eur: usd * Math.max(0, variants) * USD_EUR };
}
