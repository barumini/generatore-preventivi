import fs from "node:fs/promises";
import { resolveDataPath } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("Non trovato", { status: 404 });
  }
  const { path: parts } = await ctx.params;
  let full: string;
  try {
    full = resolveDataPath(parts.join("/"));
  } catch {
    return new Response("Percorso non valido", { status: 400 });
  }
  try {
    const data = await fs.readFile(full);
    const ext = full.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Non trovato", { status: 404 });
  }
}
