"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "./password";
import { createSession, destroySession } from "./session";
import { resetPasswordSchema } from "@/lib/shared/validation";
import { createPasswordResetToken, resetPasswordWithToken } from "./passwordReset";
import { sendPasswordResetEmail } from "@/lib/email/resend";

export type LoginState = { error: string | null };

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Credenziali non valide." };
  }

  await createSession(user.id);
  redirect("/preventivi");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export type RequestResetState = { message: string | null };

const GENERIC_RESET_MESSAGE =
  "Se l'indirizzo esiste, riceverai un'email con le istruzioni per reimpostare la password.";

function resolveAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function requestPasswordReset(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { message: GENERIC_RESET_MESSAGE };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await createPasswordResetToken(user.id);
    const resetUrl = `${resolveAppUrl()}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (error) {
      console.error("Invio email di reset password fallito", error);
    }
  }

  return { message: GENERIC_RESET_MESSAGE };
}

export type ResetPasswordState = { error: string | null };

const GENERIC_TOKEN_ERROR = "Link non valido o scaduto. Richiedine uno nuovo.";

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  if (!token) {
    return { error: GENERIC_TOKEN_ERROR };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const newPasswordHash = await hashPassword(parsed.data.password);
  const ok = await resetPasswordWithToken(token, newPasswordHash);
  if (!ok) {
    return { error: GENERIC_TOKEN_ERROR };
  }

  await destroySession();
  redirect("/login?reset=success");
}
