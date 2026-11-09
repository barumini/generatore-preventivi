import { openaiProvider } from "./openai";
import { openrouterProvider } from "./openrouter";
import type { ImageProvider } from "./types";

const PROVIDERS: ImageProvider[] = [openaiProvider, openrouterProvider];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export function listProviders(): ImageProvider[] {
  return [...PROVIDERS];
}

export function getProvider(id: string): ImageProvider {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Fornitore sconosciuto: ${id}`);
  return p;
}
