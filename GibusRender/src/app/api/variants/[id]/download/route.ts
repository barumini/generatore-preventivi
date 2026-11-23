import { getDownloadUrl } from "@vercel/blob";
import { db } from "@/lib/db";
import { routeId } from "@/lib/render/route-params";
import { isLocalFileUrl, openLocalFile } from "@/lib/storage";

export const runtime = "nodejs";

const error = (message: string, status: number) => Response.json({ error: message }, { status });

/** Solo [A-Za-z0-9_-]: impedisce l'iniezione nell'intestazione Content-Disposition. */
function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "cliente";
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx.params);
  if (!id) return error("Identificativo della variante non valido", 400);
  const variant = await db.variant.findUnique({ where: { id }, include: { render: true } });
  if (!variant) return error("Variante non trovata", 404);
  if (variant.status !== "DONE" || !variant.imageUrl) return error("Variante non ancora disponibile", 409);

  // Su Vercel Blob il file non passa dalla funzione (limite di 4,5 MB sulla risposta):
  // redirect all'URL di download del Blob (?download=1 → Content-Disposition: attachment).
  // Il nome del file scaricato è quello del Blob, non quello costruito qui sotto.
  if (!isLocalFileUrl(variant.imageUrl)) {
    return new Response(null, {
      status: 302,
      headers: { Location: getDownloadUrl(variant.imageUrl), "Cache-Control": "private, no-store" },
    });
  }

  let file: Awaited<ReturnType<typeof openLocalFile>>;
  try {
    file = await openLocalFile(variant.imageUrl);
  } catch (err) {
    console.error("Lettura variante fallita:", err);
    return error("Immagine non trovata", 404);
  }
  const filename = `GibusRender-${safeName(variant.render.clientRef)}-${safeName(variant.id)}.jpg`;
  return new Response(file.stream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
