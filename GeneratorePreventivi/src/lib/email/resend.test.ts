import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function() {
    return {
      emails: { send: sendMock },
    };
  }),
}));

const { sendPasswordResetEmail } = await import("./resend");

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "test@example.com";
  });

  it("sends an email containing the reset link", async () => {
    sendMock.mockResolvedValue({ data: { id: "abc" }, error: null });

    await sendPasswordResetEmail(
      "user@example.com",
      "https://app.test/reset-password?token=xyz"
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        from: "test@example.com",
        html: expect.stringContaining("https://app.test/reset-password?token=xyz"),
      })
    );
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "bad request" } });

    await expect(
      sendPasswordResetEmail("user@example.com", "https://app.test/reset-password?token=xyz")
    ).rejects.toThrow("bad request");
  });

  it("throws a clear error when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendPasswordResetEmail("user@example.com", "https://app.test/reset-password?token=xyz")
    ).rejects.toThrow(/RESEND_API_KEY/);
  });
});
