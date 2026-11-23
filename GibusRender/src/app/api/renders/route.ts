import { createRender } from "@/lib/render/generate";
import { readRenderRequest, renderErrorResponse } from "@/lib/render/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const read = await readRenderRequest(request);
    if ("response" in read) return read.response;
    const render = await createRender(read.input);
    return Response.json({ id: render.id });
  } catch (err) {
    return renderErrorResponse(err, "Creazione render fallita:", "Errore interno durante la creazione del render");
  }
}
