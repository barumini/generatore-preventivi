// Interfaccia comune dei fornitori di immagini. Solo tipi e la classe
// d'errore: nessun import a runtime di moduli server (ProviderSize è
// importato come tipo, quindi sharp non entra nel bundle).
import type { ProviderSize } from "@/lib/render/image";

export type { ProviderSize };

export type ProviderId = "openai" | "openrouter" | "gemini";
export type ImageQuality = "low" | "medium" | "high";

export type GenerateInput = {
  /** Foto già portata a una delle `supportedSizes` (PNG). */
  photo: Buffer;
  /** Maschera dell'app: bianco = area da modificare, nero = da lasciare. */
  mask?: Buffer;
  references: Buffer[];
  prompt: string;
  model: string;
  quality: ImageQuality;
};

export interface ImageProvider {
  id: ProviderId;
  label: string;
  supportsMask: boolean;
  supportedSizes: ProviderSize[];
  suggestedModels: string[];
  isConfigured(): boolean;
  /** Restituisce una immagine (PNG/JPEG). */
  generate(input: GenerateInput): Promise<Buffer>;
}

export type ProviderErrorKind = "config" | "rejected" | "timeout" | "quota" | "upstream";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  constructor(kind: ProviderErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderError";
    this.kind = kind;
  }
}
