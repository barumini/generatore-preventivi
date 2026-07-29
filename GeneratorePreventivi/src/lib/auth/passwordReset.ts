import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const TOKEN_DURATION_MS = 1000 * 60 * 60; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS);

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return token;
}

export async function resetPasswordWithToken(
  token: string,
  newPasswordHash: string
): Promise<boolean> {
  const tokenHash = hashToken(token);

  return prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      return false;
    }

    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: newPasswordHash },
    });
    await tx.session.deleteMany({ where: { userId: record.userId } });

    return true;
  });
}
