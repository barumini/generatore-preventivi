import { db } from "@/lib/db";
import { generateVariant } from "@/lib/render/generate";
import { routeId } from "@/lib/render/route-params";

export const runtime = "nodejs";
export const maxDuration = 300;

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx.params);
  if (!id) return error("Identificativo del render non valido", 400);
  const render = await db.render.findUnique({ where: { id }, select: { id: true } });
  if (!render) return error("Render non trovato", 404);
  try {
    return Response.json(await generateVariant(id));
  } catch (err) {
    console.error("Generazione variante fallita:", err);
    return error("Errore interno durante la generazione", 500);
  }
}
