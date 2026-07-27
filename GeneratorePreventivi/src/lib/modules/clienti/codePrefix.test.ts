import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { generateUniqueCodePrefix } from "./codePrefix";

const MARKER = "__vitest_codeprefix__";

async function createTestClient(ragioneSociale: string, codePrefix: string) {
  return prisma.client.create({
    data: { ragioneSociale: `${ragioneSociale} ${MARKER}`, codePrefix },
  });
}

describe("generateUniqueCodePrefix", () => {
  afterAll(async () => {
    await prisma.client.deleteMany({ where: { ragioneSociale: { contains: MARKER } } });
  });

  it("derives the first 3 uppercase letters from the company name", async () => {
    const prefix = await generateUniqueCodePrefix(`Zzqvex Srl ${MARKER}`);
    expect(prefix).toBe("ZZQ");
  });

  it("extends to more letters when the 3-letter prefix is already taken", async () => {
    await createTestClient("Rossi SRL", "ROS");
    const prefix = await generateUniqueCodePrefix(`Rossini SPA ${MARKER}`);
    expect(prefix).not.toBe("ROS");
    expect(prefix.startsWith("ROS")).toBe(true);
  });

  it("falls back to a numeric suffix once letter-extension is exhausted", async () => {
    await createTestClient("Aaa Corp", "AAA");
    await createTestClient("Aaa Bau", "AAAB");
    await createTestClient("Aaa Bcc", "AAABC");
    await createTestClient("Aaa Bcd", "AAABCD");
    const prefix = await generateUniqueCodePrefix(`Aaabcde Srl ${MARKER}`);
    expect(prefix).toBe("AAA2");
  });

  it("excludes the given client id from the collision check (self-rename)", async () => {
    const existing = await createTestClient("Selfcheck SRL", "SEL");
    const prefix = await generateUniqueCodePrefix(`Selfcheck SRL ${MARKER}`, existing.id);
    expect(prefix).toBe("SEL");
  });
});
