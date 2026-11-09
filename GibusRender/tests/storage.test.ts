import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import { getFile, putFile } from "@/lib/storage";

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
