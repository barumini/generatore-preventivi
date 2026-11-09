import { put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILES_PREFIX = "/api/files/";

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Risolve una chiave nella cartella .data, rifiutando percorsi che ne escono. */
export function resolveDataPath(key: string): string {
  const segments = key.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "" || s.includes("\\") || s.includes("\0"))) {
    throw new Error("Percorso file non valido");
  }
  const full = path.join(DATA_DIR, ...segments);
  if (!full.startsWith(DATA_DIR + path.sep)) throw new Error("Percorso file non valido");
  return full;
}

/** Salva un file e restituisce un URL utilizzabile in <img>. */
export async function putFile(key: string, data: Buffer, contentType: string): Promise<string> {
  if (hasBlob()) {
    const blob = await put(key, data, { access: "public", contentType, addRandomSuffix: true });
    return blob.url;
  }
  const full = resolveDataPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return FILES_PREFIX + key;
}

/** Legge un file dato l'URL restituito da putFile. */
export async function getFile(url: string): Promise<Buffer> {
  if (url.startsWith(FILES_PREFIX)) {
    return fs.readFile(resolveDataPath(url.slice(FILES_PREFIX.length)));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download file fallito (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
