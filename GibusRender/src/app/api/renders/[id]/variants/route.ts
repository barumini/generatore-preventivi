import { db } from "@/lib/db";
import { disabledProviderMessage } from "@/lib/providers/registry";
import { getSettings } from "@/lib/settings";
import { generateVariant } from "@/lib/render/generate";
import { routeId } from "@/lib/render/route-params";

export const runtime = "nodejs";
export const maxDuration = 300;

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx.params);
  if (!id) return error("Identificativo del render non valido", 400);
  const render = await db.render.findUnique({ where: { id }, select: { id: true, providerId: true } });
  if (!render) return error("Render non trovato", 404);
  // "Riprova" e "Genera altre varianti" non usano un fornitore disabilitato nel frattempo.
  const disabled = disabledProviderMessage(render.providerId, (await getSettings()).enabledProviders);
  if (disabled) return error(disabled, 400);
  try {
    return Response.json(await generateVariant(id));
  } catch (err) {
    console.error("Generazione variante fallita:", err);
    return error("Errore interno durante la generazione", 500);
  }
}
