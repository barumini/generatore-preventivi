import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

import { deleteFile, getFile, putFile, resolveDataPath } from "@/lib/storage";

beforeEach(() => {
  blob.del.mockReset();
  delete process.env.BLOB_READ_WRITE_TOKEN;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deleteFile (disco, sviluppo)", () => {
  it("elimina un file salvato e non lo trova più", async () => {
    const url = await putFile("t-del/a.txt", Buffer.from("ciao"), "text/plain");
    await expect(getFile(url)).resolves.toEqual(Buffer.from("ciao"));
    await deleteFile(url);
    await expect(getFile(url)).rejects.toThrow();
    await fs.rm(resolveDataPath("t-del/x").replace(/\/x$/, ""), { recursive: true, force: true });
  });

  it("un file già assente non è un errore", async () => {
    await expect(deleteFile("/api/files/t-del/non-esiste.txt")).resolves.toBeUndefined();
  });

  it("rifiuta percorsi che escono da .data", async () => {
    await expect(deleteFile("/api/files/../package.json")).rejects.toThrow("Percorso file non valido");
  });
});

describe("deleteFile (Vercel Blob)", () => {
  it("con il token chiama del() dell'archivio per l'URL pubblico", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "token-finto");
    blob.del.mockResolvedValue(undefined);
    await deleteFile("https://abc.public.blob.vercel-storage.com/renders/r1/v1-xyz.jpg");
    expect(blob.del).toHaveBeenCalledWith("https://abc.public.blob.vercel-storage.com/renders/r1/v1-xyz.jpg");
  });
});
