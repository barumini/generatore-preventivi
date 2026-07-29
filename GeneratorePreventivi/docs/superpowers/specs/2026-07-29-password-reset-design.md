# Password reset — design

Status: approved
Date: 2026-07-29

## Goal

Add a "forgot password" flow to the existing email/password auth system
(`src/lib/auth/`), so staff users who forget their password can reset it
without an admin's help.

## Context

Existing auth (`src/lib/auth/session.ts`, `password.ts`, `actions.ts`) uses:
- bcrypt password hashing (`hashPassword`/`verifyPassword`)
- DB-backed sessions: random token in a cookie, only its SHA-256 hash stored
  in the `Session` table, checked + expired server-side
- A single login Server Action + `useActionState` form (`src/app/(auth)/login/page.tsx`)

No email-sending library exists yet, and no signup flow (users are created
out-of-band). This feature adds the reset flow only — it does not add
signup.

## 1. Data model

New Prisma model, mirroring the `Session` token pattern:

```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@map("password_reset_tokens")
}
```

`User` gets a `passwordResetTokens PasswordResetToken[]` back-relation.

A Prisma migration is required for this change.

## 2. Token lifecycle (`src/lib/auth/passwordReset.ts`)

- `createPasswordResetToken(userId): Promise<string>`
  - Generates 32 random bytes (`randomBytes(32).toString("base64url")`) as
    the raw token (returned to caller, never persisted in plaintext).
  - Persists only `sha256(token)` with `expiresAt = now + 1h`.
  - Deletes any existing unused, unexpired tokens for that user first (a
    user should only ever have one live reset link at a time).
- `consumePasswordResetToken(token): Promise<string | null>`
  - Hashes the incoming token, looks up the row.
  - Valid only if found, `usedAt === null`, and `expiresAt > now`.
  - On success, the caller (in the same DB transaction as the password
    update) sets `usedAt = now` so the token cannot be replayed, and
    returns the `userId`. Returns `null` on any failure — the caller
    cannot distinguish "not found" from "expired" from "already used".

## 3. Email delivery — Resend

- New dependency: `resend`.
- `src/lib/email/resend.ts` exports `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>`, wrapping a `Resend` client instance.
- Env vars:
  - `RESEND_API_KEY` — required at runtime for actually sending mail.
  - `RESEND_FROM_EMAIL` — sender address. Ships with a placeholder
    (`onboarding@resend.dev`, Resend's own sandbox sender) since no
    verified domain has been chosen yet. Must be replaced with a verified
    sender before this reaches real users in production.
  - `APP_URL` — base URL used to build the absolute reset link. Falls back
    to `https://${VERCEL_URL}` when unset (Vercel sets `VERCEL_URL`
    automatically in deployments).

## 4. Server Actions (`src/lib/auth/actions.ts`)

- `requestPasswordReset(prevState, formData): Promise<{ message: string }>`
  - Validates `email` is present (zod).
  - Looks up the user by email.
  - If found: creates a reset token, sends the email with a link to
    `${APP_URL}/reset-password?token=<raw token>`.
  - **Always returns the same generic message** regardless of whether the
    user was found ("Se l'indirizzo esiste, riceverai un'email con le
    istruzioni.") — prevents user enumeration via response differences.
  - Any email-send failure is logged server-side but not surfaced to the
    caller (same generic message either way).

- `resetPassword(prevState, formData): Promise<ResetPasswordState>`
  - Validates `token` (present), `password` (zod: min 8 chars, at least
    one letter and one digit — matching the Next.js docs' example
    complexity rule), and `confirmPassword` (must match `password`).
  - Calls `consumePasswordResetToken`; if it returns `null`, returns a
    generic error: "Link non valido o scaduto. Richiedine uno nuovo."
  - On success: in one Prisma transaction — hash the new password, update
    `User.passwordHash`, mark the token `usedAt`, and delete **all**
    `Session` rows for that `userId` (forces logout everywhere, standard
    practice after a credential change).
  - Redirects to `/login?reset=success`.

## 5. UI pages

Same minimal inline-styled pattern as the existing login page
(`useActionState` + `useFormStatus` submit button):

- `src/app/(auth)/forgot-password/page.tsx` — single email field, submits
  to `requestPasswordReset`, shows the generic message after submit (no
  redirect — the user stays on the page and reads the confirmation).
- `src/app/(auth)/reset-password/page.tsx` — reads `token` from
  `searchParams`. If absent, renders a static error state (no form, no
  action call). Otherwise renders new-password + confirm-password fields,
  submits to `resetPassword`, includes the token as a hidden field.
- `src/app/(auth)/login/page.tsx` — add a "Password dimenticata?" link to
  `/forgot-password` below the form, and render a small success banner
  when `?reset=success` is present in the URL.

## 6. Error handling / edge cases

- Non-existent email at request time → same generic success message (no
  leak).
- Expired / already-used / unknown token at reset time → same generic
  error message (no leak of which case applied).
- No dedicated rate limiting on `requestPasswordReset` — explicitly out of
  scope for this internal staff tool. Noted here so it isn't silently
  forgotten, not implemented.
- No signup flow exists or is added; this only covers resetting an
  existing user's password.

## 7. Testing

Following the existing pattern (`src/lib/modules/clienti/codePrefix.test.ts`):
tests hit the real dev database directly via `prisma`, with a marker +
`afterAll` cleanup. Email sending is mocked in tests (never calls Resend
for real).

Coverage:
- `passwordReset.ts`: token creation, successful consumption, rejection of
  expired/used/unknown tokens, and that creating a new token invalidates
  a prior unused one.
- `resetPassword` action: zod validation rejects mismatched/too-weak
  passwords; successful reset updates the password hash and deletes all
  sessions for the user.
- `requestPasswordReset` action: returns the same message for an existing
  vs. non-existing email.

## 8. New environment variables

Add to `.env` (local, with placeholders) and document as required in
Vercel project settings:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (placeholder `onboarding@resend.dev` until a
  verified sending domain is chosen)
- `APP_URL` (optional locally; falls back to `VERCEL_URL` in deployments)
