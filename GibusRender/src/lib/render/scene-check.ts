// Soglia e regola per segnalare le varianti in cui il modello ha rifatto la scena.
// Modulo puro, usabile anche lato browser.

/**
 * Differenza media (0–255) fuori dalla sagoma oltre la quale una variante è segnalata
 * "scena alterata". Taratura del 2026-11-10 su una foto reale (1024×768, sagoma larga):
 * varianti buone 4,4–7,3 (FLUX.3 Klein, Nano Banana 2); scena rifatta 25–48
 * (GPT Image 1.5 low, Nano Banana Lite, una variante di Nano Banana 2).
 */
export const DRIFT_ALTERED_THRESHOLD = 12;

export function isSceneAltered(driftScore: number | null | undefined): boolean {
  return typeof driftScore === "number" && driftScore > DRIFT_ALTERED_THRESHOLD;
}
