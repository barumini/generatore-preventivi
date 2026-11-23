import {
  MAX_BODY_BYTES,
  PHOTO_TOO_LARGE,
  PhotoTooLargeError,
  RenderInputError,
  SourceRenderNotFoundError,
  renderInputFromForm,
  type CreateRenderInput,
} from "@/lib/render/generate";
import { getSettings } from "@/lib/settings";

export const errorResponse = (message: string, status: number) => Response.json({ error: message }, { status });

/**
 * Legge e valida il corpo multipart di una richiesta di render: limite di dimensione,
 * impostazioni predefinite, fornitore abilitato. Restituisce il modulo e l'input,
 * oppure la risposta d'errore da restituire così com'è. Può lanciare RenderInputError.
 */
export async function readRenderRequest(
  request: Request,
): Promise<{ form: FormData; input: CreateRenderInput } | { response: Response }> {
  // Oltre questo limite il proxy tronca il corpo: rispondere 413 prima di leggerlo.
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return { response: errorResponse(PHOTO_TOO_LARGE, 413) };
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { response: errorResponse("Richiesta non valida: atteso un modulo multipart", 400) };
  }
  const settings = await getSettings();
  const input = renderInputFromForm(form, {
    providerId: settings.activeProviderId,
    model: settings.activeModel,
    quality: settings.quality,
    variants: settings.defaultVariants,
    maxPhotoSide: settings.maxPhotoSide,
  });
  if (!settings.enabledProviders.includes(input.providerId)) {
    return { response: errorResponse("Fornitore non abilitato nelle impostazioni", 400) };
  }
  return { form, input };
}

/** Errore di creazione → risposta HTTP; gli errori non previsti diventano 500 con `fallback`. */
export function renderErrorResponse(err: unknown, fallbackLog: string, fallback: string): Response {
  if (err instanceof PhotoTooLargeError) return errorResponse(err.message, 413);
  if (err instanceof SourceRenderNotFoundError) return errorResponse(err.message, 404);
  if (err instanceof RenderInputError) return errorResponse(err.message, 400);
  console.error(fallbackLog, err);
  return errorResponse(fallback, 500);
}
