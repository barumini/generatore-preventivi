import { parseCombos } from "@/lib/render/combos";
import { createComparison } from "@/lib/render/comparison";
import { errorResponse, readRenderRequest, renderErrorResponse } from "@/lib/render/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const read = await readRenderRequest(request);
    if ("response" in read) return read.response;
    const raw = read.form.get("finishes");
    let combos;
    try {
      combos = parseCombos(typeof raw === "string" ? JSON.parse(raw) : undefined);
    } catch {
      return errorResponse("Finiture del confronto non valide", 400);
    }
    const { id } = await createComparison(read.input, combos);
    return Response.json({ id });
  } catch (err) {
    return renderErrorResponse(err, "Creazione confronto fallita:", "Errore interno durante la creazione del confronto");
  }
}
