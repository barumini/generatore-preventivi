import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { createPasswordResetToken } from "./passwordReset";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    const err = new Error("REDIRECT");
    (err as { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const { sendPasswordResetEmailMock } = vi.hoisted(() => ({
  sendPasswordResetEmailMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email/resend", () => ({ sendPasswordResetEmail: sendPasswordResetEmailMock }));

// resetPassword calls destroySession() on success, which reads/clears the request's
// cookie jar via next/headers. Outside of a real Next.js request scope (as in these
// unit tests), `cookies()` throws, so provide a minimal in-memory stand-in. No cookie
// is ever set by these tests, so destroySession() resolves as a no-op, matching the
// common real-world case (an unauthenticated browser following an emailed reset link).
const { cookiesMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    cookiesMock: vi.fn(async () => ({
      get: (name: string) => (store.has(name) ? { value: store.get(name)! } : undefined),
      set: (name: string, value: string) => {
        store.set(name, value);
      },
      delete: (name: string) => {
        store.delete(name);
      },
    })),
  };
});
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

const { requestPasswordReset, resetPassword } = await import("./actions");

const MARKER = "__vitest_actions_pwreset__";
const GENERIC_MESSAGE_FRAGMENT = "riceverai un'email";

async function createTestUser(suffix: string) {
  return prisma.user.create({
    data: {
      email: `${MARKER}${suffix}@test.local`,
      name: "Test User",
      passwordHash: await hashPassword("old-password-1"),
    },
  });
}

describe("requestPasswordReset", () => {
  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: MARKER } } });
    const userIds = users.map((u) => u.id);
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  beforeEach(() => {
    sendPasswordResetEmailMock.mockClear();
  });

  it("returns the generic message and sends an email for an existing user", async () => {
    const user = await createTestUser("existing");
    const formData = new FormData();
    formData.set("email", user.email);

    const result = await requestPasswordReset({ message: null }, formData);

    expect(result.message).toContain(GENERIC_MESSAGE_FRAGMENT);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    const tokenCount = await prisma.passwordResetToken.count({ where: { userId: user.id } });
    expect(tokenCount).toBe(1);
  });

  it("returns the same generic message and sends no email for a non-existing address", async () => {
    const formData = new FormData();
    formData.set("email", `${MARKER}nobody@test.local`);

    const result = await requestPasswordReset({ message: null }, formData);

    expect(result.message).toContain(GENERIC_MESSAGE_FRAGMENT);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("returns the exact same message for an existing and a non-existing email (anti-enumeration)", async () => {
    const user = await createTestUser("existing-exact");
    const existingFormData = new FormData();
    existingFormData.set("email", user.email);
    const existingResult = await requestPasswordReset({ message: null }, existingFormData);

    const nonExistingFormData = new FormData();
    nonExistingFormData.set("email", `${MARKER}nobody-exact@test.local`);
    const nonExistingResult = await requestPasswordReset({ message: null }, nonExistingFormData);

    expect(existingResult.message).toBe(nonExistingResult.message);
  });

  it("still returns the generic success message when sending the email fails", async () => {
    const user = await createTestUser("email-send-failure");
    sendPasswordResetEmailMock.mockRejectedValueOnce(new Error("send failed"));
    const formData = new FormData();
    formData.set("email", user.email);

    const result = await requestPasswordReset({ message: null }, formData);

    expect(result.message).toContain(GENERIC_MESSAGE_FRAGMENT);
  });
});

describe("resetPassword", () => {
  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: MARKER } } });
    const userIds = users.map((u) => u.id);
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: MARKER } } });
  });

  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("rejects a too-weak password without redirecting", async () => {
    const user = await createTestUser("weak-password");
    const token = await createPasswordResetToken(user.id);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("password", "short");
    formData.set("confirmPassword", "short");

    const result = await resetPassword({ error: null }, formData);

    expect(result.error).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without redirecting", async () => {
    const user = await createTestUser("mismatch");
    const token = await createPasswordResetToken(user.id);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("password", "goodpassword1");
    formData.set("confirmPassword", "differentpass1");

    const result = await resetPassword({ error: null }, formData);

    expect(result.error).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("updates the password, deletes sessions, and redirects on success", async () => {
    const user = await createTestUser("success");
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: "fake-session-hash-success",
        expiresAt: new Date(Date.now() + 100_000),
      },
    });
    const token = await createPasswordResetToken(user.id);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("password", "brandnewpass1");
    formData.set("confirmPassword", "brandnewpass1");

    await expect(resetPassword({ error: null }, formData)).rejects.toThrow("REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/login?reset=success");
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("brandnewpass1", updated.passwordHash)).toBe(true);
    const remainingSessions = await prisma.session.count({ where: { userId: user.id } });
    expect(remainingSessions).toBe(0);
  });

  it("returns a generic error for an invalid token", async () => {
    const formData = new FormData();
    formData.set("token", "not-a-real-token");
    formData.set("password", "brandnewpass1");
    formData.set("confirmPassword", "brandnewpass1");

    const result = await resetPassword({ error: null }, formData);

    expect(result.error).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
