import { openaiProvider } from "./openai";
import { geminiProvider } from "./gemini";
import { openrouterProvider } from "./openrouter";
import type { ImageProvider } from "./types";

const PROVIDERS: ImageProvider[] = [openaiProvider, openrouterProvider, geminiProvider];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export function listProviders(): ImageProvider[] {
  return [...PROVIDERS];
}

export function getProvider(id: string): ImageProvider {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Fornitore sconosciuto: ${id}`);
  return p;
}

/**
 * Messaggio da mostrare se il fornitore del render è stato disabilitato nelle
 * impostazioni (non si generano altre varianti con lui); null se è abilitato.
 */
export function disabledProviderMessage(providerId: string, enabledProviders: readonly string[]): string | null {
  if (enabledProviders.includes(providerId)) return null;
  const label = PROVIDERS.find((p) => p.id === providerId)?.label ?? providerId;
  return `Fornitore ${label} disabilitato nelle impostazioni: duplica il render e scegli un altro fornitore`;
}
