import {
  createRender,
  MAX_BODY_BYTES,
  PHOTO_TOO_LARGE,
  PhotoTooLargeError,
  RenderInputError,
  renderInputFromForm,
} from "@/lib/render/generate";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  // Oltre questo limite il proxy tronca il corpo: rispondere 413 prima di leggerlo.
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return error(PHOTO_TOO_LARGE, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Richiesta non valida: atteso un modulo multipart", 400);
  }
  try {
    const settings = await getSettings();
    const input = renderInputFromForm(form, {
      providerId: settings.activeProviderId,
      model: settings.activeModel,
      quality: settings.quality,
      variants: settings.defaultVariants,
    });
    if (!settings.enabledProviders.includes(input.providerId)) {
      return error("Fornitore non abilitato nelle impostazioni", 400);
    }
    const render = await createRender(input);
    return Response.json({ id: render.id });
  } catch (err) {
    if (err instanceof PhotoTooLargeError) return error(err.message, 413);
    if (err instanceof RenderInputError) return error(err.message, 400);
    console.error("Creazione render fallita:", err);
    return error("Errore interno durante la creazione del render", 500);
  }
}
