import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import { getFile, openLocalFile, putFile } from "@/lib/storage";

describe("storage su disco (senza BLOB_READ_WRITE_TOKEN)", () => {
  beforeAll(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
  afterAll(async () => {
    await fs.rm(".data/t", { recursive: true, force: true });
  });

  it("putFile restituisce l'URL e getFile rilegge il contenuto", async () => {
    const url = await putFile("t/x.txt", Buffer.from("ciao"), "text/plain");
    expect(url).toBe("/api/files/t/x.txt");
    expect((await getFile(url)).toString()).toBe("ciao");
  });

  it("rifiuta percorsi con ..", async () => {
    await expect(getFile("/api/files/../package.json")).rejects.toThrow();
    await expect(putFile("../evil.txt", Buffer.from("x"), "text/plain")).rejects.toThrow();
  });
});

describe("storage in produzione senza BLOB_READ_WRITE_TOKEN", () => {
  const MESSAGE = "Archivio file non configurato: manca BLOB_READ_WRITE_TOKEN";
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("putFile, getFile e openLocalFile su /api/files lanciano un errore chiaro", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    await expect(putFile("t/prod.txt", Buffer.from("x"), "text/plain")).rejects.toThrow(MESSAGE);
    await expect(getFile("/api/files/t/x.txt")).rejects.toThrow(MESSAGE);
    await expect(openLocalFile("/api/files/t/x.txt")).rejects.toThrow(MESSAGE);
    await expect(fs.access(".data/t/prod.txt")).rejects.toThrow();
  });

  it("in sviluppo il disco resta disponibile", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const url = await putFile("t/dev.txt", Buffer.from("ok"), "text/plain");
    expect((await getFile(url)).toString()).toBe("ok");
  });
});
