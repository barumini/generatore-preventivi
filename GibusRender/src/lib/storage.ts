import { del, put } from "@vercel/blob";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILES_PREFIX = "/api/files/";

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * In produzione il disco delle funzioni non è persistente: senza Blob si
 * fallisce subito con un messaggio chiaro invece di salvare file che spariscono.
 */
function assertDiskAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Archivio file non configurato: manca BLOB_READ_WRITE_TOKEN");
  }
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
  assertDiskAllowed();
  const full = resolveDataPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return FILES_PREFIX + key;
}

/** Elimina un file salvato (disco o Blob); un file già assente non è un errore. */
export async function deleteFile(url: string): Promise<void> {
  if (url.startsWith(FILES_PREFIX)) {
    assertDiskAllowed();
    await fs.rm(resolveDataPath(url.slice(FILES_PREFIX.length)), { force: true });
    return;
  }
  if (!hasBlob()) throw new Error("Archivio file non configurato: manca BLOB_READ_WRITE_TOKEN");
  await del(url);
}

/** true per gli URL dei file salvati su disco (sviluppo), serviti da /api/files. */
export function isLocalFileUrl(url: string): boolean {
  return url.startsWith(FILES_PREFIX);
}

/**
 * Apre in streaming un file salvato su disco (URL /api/files/...), senza
 * caricarlo tutto in memoria. Lancia se il file non esiste.
 */
export async function openLocalFile(url: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
  if (!isLocalFileUrl(url)) throw new Error("Non è un file locale");
  assertDiskAllowed();
  const full = resolveDataPath(url.slice(FILES_PREFIX.length));
  const { size } = await fs.stat(full);
  return { stream: Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>, size };
}

/** Legge un file dato l'URL restituito da putFile. */
export async function getFile(url: string): Promise<Buffer> {
  if (url.startsWith(FILES_PREFIX)) {
    assertDiskAllowed();
    return fs.readFile(resolveDataPath(url.slice(FILES_PREFIX.length)));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download file fallito (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
