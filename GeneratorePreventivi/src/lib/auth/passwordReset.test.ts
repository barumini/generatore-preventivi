import { describe, it, expect, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";
import { createPasswordResetToken, resetPasswordWithToken } from "./passwordReset";

const MARKER = "__vitest_pwreset__";

async function createTestUser(suffix: string) {
  return prisma.user.create({
    data: {
      email: `${MARKER}${suffix}@test.local`,
      name: "Test User",
      passwordHash: await hashPassword("old-password-1"),
    },
  });
}

describe("passwordReset", () => {
  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: MARKER } } });
    const userIds = users.map((u) => u.id);
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  it("creates a token that can be consumed exactly once", async () => {
    const user = await createTestUser("consume-once");
    const token = await createPasswordResetToken(user.id);

    const firstAttempt = await resetPasswordWithToken(token, await hashPassword("new-password-1"));
    expect(firstAttempt).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash).not.toBe(user.passwordHash);

    const secondAttempt = await resetPasswordWithToken(token, await hashPassword("another-password-2"));
    expect(secondAttempt).toBe(false);
  });

  it("rejects an unknown token", async () => {
    const result = await resetPasswordWithToken("not-a-real-token", await hashPassword("whatever-1"));
    expect(result).toBe(false);
  });

  it("rejects an expired token", async () => {
    const user = await createTestUser("expired");
    const token = await createPasswordResetToken(user.id);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await resetPasswordWithToken(token, await hashPassword("whatever-1"));
    expect(result).toBe(false);
  });

  it("deletes all sessions for the user on a successful reset", async () => {
    const user = await createTestUser("sessions");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: "fake-session-hash-sessions",
        expiresAt: new Date(Date.now() + 100_000),
      },
    });
    const token = await createPasswordResetToken(user.id);

    await resetPasswordWithToken(token, await hashPassword("new-password-1"));

    const remaining = await prisma.session.count({ where: { userId: user.id } });
    expect(remaining).toBe(0);
  });

  it("invalidates a previous unused token when a new one is created", async () => {
    const user = await createTestUser("invalidate-prev");
    const firstToken = await createPasswordResetToken(user.id);
    await createPasswordResetToken(user.id);

    const result = await resetPasswordWithToken(firstToken, await hashPassword("whatever-1"));
    expect(result).toBe(false);
  });
});
