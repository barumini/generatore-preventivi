import type { ProviderSize } from "./types";

/**
 * Dimensioni e rapporti d'aspetto dei modelli immagine Gemini (ai.google.dev,
 * 2026-11-09). Usati sia dal fornitore Google Gemini diretto sia via OpenRouter.
 */
export const GEMINI_SIZES: (ProviderSize & { ratio: string })[] = [
  { width: 1024, height: 1024, ratio: "1:1" },
  { width: 1248, height: 832, ratio: "3:2" },
  { width: 832, height: 1248, ratio: "2:3" },
  { width: 1184, height: 864, ratio: "4:3" },
  { width: 864, height: 1184, ratio: "3:4" },
  { width: 1152, height: 896, ratio: "5:4" },
  { width: 896, height: 1152, ratio: "4:5" },
  { width: 1344, height: 768, ratio: "16:9" },
  { width: 768, height: 1344, ratio: "9:16" },
];

/** Rapporto d'aspetto Gemini corrispondente a una dimensione esatta, se esiste. */
export function geminiRatio(width: number | undefined, height: number | undefined): string | undefined {
  return GEMINI_SIZES.find((s) => s.width === width && s.height === height)?.ratio;
}

/** Testo per il modello: prompt + descrizione dell'ordine delle immagini allegate. */
export function geminiPromptText(prompt: string, hasMask: boolean, referenceCount: number): string {
  const lines = [prompt, "", "The first image is the photo to edit."];
  if (hasMask) {
    lines.push(
      "The second image is a mask: white = area to edit, black = keep exactly as in the photo. Do not draw the mask in the result.",
    );
  }
  if (referenceCount) lines.push("The remaining images are reference images of the product.");
  return lines.join("\n");
}
