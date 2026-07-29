# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user who forgot their password request a reset link by email and set a new password, without any admin involvement.

**Architecture:** A new `PasswordResetToken` Prisma model stores only the SHA-256 hash of a random token (mirroring the existing `Session` model's pattern). Two new Server Actions (`requestPasswordReset`, `resetPassword`) drive two new pages (`/forgot-password`, `/reset-password`). Email is sent via Resend. A successful reset invalidates all of the user's existing sessions.

**Tech Stack:** Next.js 16 (App Router, this version — read `node_modules/next/dist/docs` before touching any Next.js API, per `AGENTS.md`), Prisma 7 + `@prisma/adapter-pg`, bcryptjs, zod, vitest, Resend.

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/01-app/` before writing any Next.js-specific code (page props, Server Actions) — this Next.js version has breaking changes vs. training data (`AGENTS.md`).
- `searchParams` in a page component is `Promise<{ [key: string]: string | string[] | undefined }>` and must be awaited — confirmed in `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md:254-264`.
- `useSearchParams()` (client hook) requires the nearest Suspense boundary to allow prerendering of everything above it — confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` ("Behavior > Prerendering").
- Follow the existing code style exactly: inline `style={{...}}` objects (no CSS modules, no new UI abstractions), `useActionState` + `useFormStatus` for forms, Italian user-facing copy, tokens from `src/styles/tokens.css` (`var(--brand)`, `var(--gray-100)`, `var(--border-default)`, `var(--radius-md)`, `var(--radius-lg)`, `var(--text-secondary)`, `var(--teal-800)`, `var(--font-sans)`, `var(--color-error)`, `var(--color-error-bg)`, `var(--color-success)`, `var(--color-success-bg)`).
- Tests hit the real dev/prod Prisma Postgres database directly (there is no separate test DB in this project — `src/lib/modules/clienti/codePrefix.test.ts` already does this). Every test that creates data MUST use a unique marker string in an identifying field and clean up in `afterAll`, exactly like `codePrefix.test.ts` does.
- Password validation rule: minimum 8 characters, at least one letter, at least one digit (matches the Next.js docs' own example complexity rule).
- Never leak whether an email address belongs to a real account: `requestPasswordReset` always returns the same message.
- Never leak *why* a reset token failed (expired vs. used vs. unknown): `resetPassword` always returns the same generic error for any invalid token.
- `.env*` is gitignored (confirmed via `.gitignore`) — safe to add placeholder secrets there without risk of committing them.
- Package manager is npm (`package-lock.json` present, no yarn/pnpm lockfile).

---

### Task 1: `PasswordResetToken` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma:18-31` (add relation field to `User`), and add a new model after the `Session` model (`prisma/schema.prisma:44`)
- Generated: a new folder under `prisma/migrations/` (created by the `prisma migrate dev` command, not hand-written)

**Interfaces:**
- Produces: Prisma model `PasswordResetToken` with fields `id`, `userId`, `tokenHash` (unique), `expiresAt`, `usedAt` (nullable), `createdAt`, and relation `user`. Later tasks query this via `prisma.passwordResetToken.*`.

- [ ] **Step 1: Add the relation field to `User`**

In `prisma/schema.prisma`, inside the `User` model (currently lines 18-31), add `passwordResetTokens PasswordResetToken[]` next to the existing `sessions Session[]` line:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions            Session[]
  passwordResetTokens PasswordResetToken[]
  createdQuotes       Quote[]              @relation("QuoteCreatedBy")
  issuedQuotes        Quote[]              @relation("QuoteIssuedBy")

  @@map("users")
}
```

- [ ] **Step 2: Add the `PasswordResetToken` model**

Immediately after the `Session` model (currently ending at line 44 with `}` before `model Client {`), insert:

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

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Create and apply the migration**

Run: `npx prisma migrate dev --name add_password_reset_tokens`
Expected: output ending in `Your database is now in sync with your schema.` and a new folder like `prisma/migrations/<timestamp>_add_password_reset_tokens/migration.sql` containing a `CREATE TABLE "password_reset_tokens" (...)` statement. This also regenerates the Prisma Client into `src/generated/prisma`.

- [ ] **Step 5: Confirm the generated client has the new model**

Run: `grep -n "passwordResetToken" src/generated/prisma/client.ts | head -5`
Expected: at least one match (the generated client exposes `prisma.passwordResetToken`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add PasswordResetToken model and migration"
```

---

### Task 2: Token lifecycle module

**Files:**
- Create: `src/lib/auth/passwordReset.ts`
- Test: `src/lib/auth/passwordReset.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (existing); `prisma.passwordResetToken` (Task 1).
- Produces:
  - `createPasswordResetToken(userId: string): Promise<string>` — returns the raw (unhashed) token.
  - `resetPasswordWithToken(token: string, newPasswordHash: string): Promise<boolean>` — atomically validates the token, updates `User.passwordHash`, marks the token used, and deletes all of that user's `Session` rows. Returns `true` on success, `false` if the token is unknown, expired, or already used. Later tasks (Task 4) call this from the `resetPassword` Server Action.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/passwordReset.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/auth/passwordReset.test.ts`
Expected: FAIL — `Cannot find module './passwordReset'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `passwordReset.ts`**

Create `src/lib/auth/passwordReset.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/auth/passwordReset.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/passwordReset.ts src/lib/auth/passwordReset.test.ts
git commit -m "Add password reset token lifecycle module"
```

---

### Task 3: Resend email module

**Files:**
- Modify: `package.json` (new dependency), `.env` (new placeholder env vars)
- Create: `src/lib/email/resend.ts`
- Test: `src/lib/email/resend.test.ts`

**Interfaces:**
- Produces: `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>` — throws on failure (missing API key, or Resend API error). Task 4's `requestPasswordReset` action calls this and catches/logs any error without surfacing it to the caller.

- [ ] **Step 1: Install the `resend` dependency**

Run: `npm install resend`
Expected: `package.json` gains `"resend": "^<version>"` under `dependencies`, and `package-lock.json` is updated.

- [ ] **Step 2: Add placeholder env vars**

Append to `.env` (do not remove existing content):

```
# Resend — invio email transazionali (reset password)
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
APP_URL=http://localhost:3000
```

`RESEND_FROM_EMAIL` uses Resend's own sandbox sender since no verified domain has been chosen yet — replace with a verified sender before using this in production. `RESEND_API_KEY` must be filled in with a real key (from the Resend dashboard) for email sending to actually work; without it, `sendPasswordResetEmail` throws a clear error (see Step 4) rather than silently failing.

- [ ] **Step 3: Write the failing tests**

Create `src/lib/email/resend.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
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
```

Two things to note about this test file:
- `vi.mock("resend", ...)` calls are hoisted above all other top-level statements by Vitest. A factory cannot close over a plain `const` declared earlier in the file — it wouldn't be initialized yet when the hoisted mock runs. `vi.hoisted(...)` is the supported way to define a value that's safe to reference inside a `vi.mock` factory.
- The file uses top-level `await import("./resend")` (not a static top-of-file import) so that the `vi.mock("resend", ...)` call above it is guaranteed to apply before `./resend` (which imports the real `resend` package) is loaded.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/email/resend.test.ts`
Expected: FAIL — `Cannot find module './resend'`.

- [ ] **Step 5: Implement `resend.ts`**

Create `src/lib/email/resend.ts`:

```ts
import { Resend } from "resend";

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY non configurata: impossibile inviare email.");
  }
  return new Resend(apiKey);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const client = getClient();
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const { error } = await client.emails.send({
    from,
    to,
    subject: "Reimposta la tua password — Generatore preventivi",
    html: `
      <p>Hai richiesto di reimpostare la password per il Generatore preventivi DIH Vicenza.</p>
      <p><a href="${resetUrl}">Clicca qui per scegliere una nuova password</a> (link valido 1 ora).</p>
      <p>Se non hai richiesto tu il reset, ignora pure questa email.</p>
    `,
  });

  if (error) {
    throw new Error(`Invio email fallito: ${error.message}`);
  }
}
```

Note the module-level `getClient()` function instantiates the Resend client lazily, inside the function that needs it — not at module load time. This means the module can be imported anywhere (including during `next build`) without `RESEND_API_KEY` being set; the error only surfaces when an email actually needs to be sent.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/email/resend.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/email/resend.ts src/lib/email/resend.test.ts
git commit -m "Add Resend email module for password reset"
```

Note: `.env` is gitignored and intentionally not committed — the placeholders from Step 2 stay local only.

---

### Task 4: Server Actions — `requestPasswordReset` and `resetPassword`

**Files:**
- Modify: `src/lib/shared/validation.ts` (add password schema)
- Modify: `src/lib/auth/actions.ts` (add two new exported actions)
- Test: `src/lib/auth/actions.test.ts`

**Interfaces:**
- Consumes: `createPasswordResetToken`, `resetPasswordWithToken` from `./passwordReset` (Task 2); `sendPasswordResetEmail` from `@/lib/email/resend` (Task 3); `hashPassword` from `./password` (existing); `prisma` from `@/lib/db` (existing).
- Produces:
  - `export type RequestResetState = { message: string | null }`
  - `requestPasswordReset(prevState: RequestResetState, formData: FormData): Promise<RequestResetState>`
  - `export type ResetPasswordState = { error: string | null }`
  - `resetPassword(prevState: ResetPasswordState, formData: FormData): Promise<ResetPasswordState>` — redirects to `/login?reset=success` on success (throws Next's redirect signal, does not return in that case).
  - Task 5's UI pages import `requestPasswordReset`/`RequestResetState` and `resetPassword`/`ResetPasswordState` from `@/lib/auth/actions`.

- [ ] **Step 1: Add the password validation schema**

In `src/lib/shared/validation.ts`, add at the end of the file (same `z.object`/message-string style as the existing schemas):

```ts
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "La password deve avere almeno 8 caratteri")
      .regex(/[a-zA-Z]/, "La password deve contenere almeno una lettera")
      .regex(/[0-9]/, "La password deve contenere almeno un numero"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/auth/actions.test.ts`:

```ts
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
```

Same two notes as `src/lib/email/resend.test.ts` in Task 3 apply here: `vi.hoisted(...)` is required because `vi.mock` factories are hoisted above plain `const` declarations, and `./actions` is imported via top-level `await import(...)` so the mocks of `next/navigation` and `@/lib/email/resend` are in place before `actions.ts` (which imports both) loads.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/auth/actions.test.ts`
Expected: FAIL — `requestPasswordReset`/`resetPassword` are not exported from `./actions` yet.

- [ ] **Step 4: Implement the actions**

In `src/lib/auth/actions.ts`, add these imports at the top (alongside the existing ones):

```ts
import { resetPasswordSchema } from "@/lib/shared/validation";
import { hashPassword } from "./password";
import { createPasswordResetToken, resetPasswordWithToken } from "./passwordReset";
import { sendPasswordResetEmail } from "@/lib/email/resend";
```

Then append at the end of the file:

```ts
export type RequestResetState = { message: string | null };

const GENERIC_RESET_MESSAGE =
  "Se l'indirizzo esiste, riceverai un'email con le istruzioni per reimpostare la password.";

function resolveAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
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

  redirect("/login?reset=success");
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/auth/actions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: all tests pass (existing `calc.test.ts`, `codePrefix.test.ts`, plus the three new files).

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/validation.ts src/lib/auth/actions.ts src/lib/auth/actions.test.ts
git commit -m "Add requestPasswordReset and resetPassword Server Actions"
```

---

### Task 5: UI pages

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`
- Create: `src/app/(auth)/reset-password/reset-password-form.tsx`
- Modify: `src/app/(auth)/login/page.tsx` (split into server wrapper + client form, per the `useSearchParams`/Suspense guidance in Global Constraints)
- Create: `src/app/(auth)/login/login-form.tsx`

**Interfaces:**
- Consumes: `requestPasswordReset`, `RequestResetState`, `resetPassword`, `ResetPasswordState`, `login`, `LoginState` — all from `@/lib/auth/actions` (Task 4 + existing).
- Produces: routes `/forgot-password` and `/reset-password?token=...`; no other module depends on these files.

There are no automated tests for these pages — this matches the existing codebase, which has no page-level tests. Verification is manual (Task 6).

- [ ] **Step 1: Create the forgot-password page**

Create `src/app/(auth)/forgot-password/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { requestPasswordReset, type RequestResetState } from "@/lib/auth/actions";

const initialState: RequestResetState = { message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: "100%",
        height: 40,
        background: "var(--brand)",
        color: "#fff",
        border: "1px solid var(--brand)",
        borderRadius: "var(--radius-md)",
        cursor: pending ? "default" : "pointer",
        font: "600 14px var(--font-sans)",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Invio in corso…" : "Invia link di reset"}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--gray-100)",
      }}
    >
      <form
        action={formAction}
        style={{
          width: 360,
          background: "#fff",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
        }}
      >
        <div
          style={{
            font: "700 16px var(--font-sans)",
            color: "var(--teal-800)",
            marginBottom: 4,
          }}
        >
          Password dimenticata
        </div>
        <div
          style={{
            font: "400 12px var(--font-sans)",
            color: "var(--text-secondary)",
            marginBottom: 20,
          }}
        >
          Inserisci la tua email: se corrisponde a un account esistente riceverai un link per reimpostare la password.
        </div>

        {state.message ? (
          <div
            style={{
              font: "400 13px var(--font-sans)",
              color: "var(--color-success)",
              background: "var(--color-success-bg)",
              borderRadius: "var(--radius-md)",
              padding: "8px 10px",
              marginBottom: 14,
            }}
          >
            {state.message}
          </div>
        ) : (
          <>
            <label
              style={{
                display: "block",
                font: "500 13px var(--font-sans)",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              style={{
                width: "100%",
                height: 38,
                padding: "0 12px",
                marginBottom: 18,
                font: "400 14px var(--font-sans)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                outline: "none",
              }}
            />
            <SubmitButton />
          </>
        )}

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link
            href="/login"
            style={{ font: "500 13px var(--font-sans)", color: "var(--brand)" }}
          >
            Torna al login
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create the reset-password client form**

Create `src/app/(auth)/reset-password/reset-password-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPassword, type ResetPasswordState } from "@/lib/auth/actions";

const initialState: ResetPasswordState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: "100%",
        height: 40,
        background: "var(--brand)",
        color: "#fff",
        border: "1px solid var(--brand)",
        borderRadius: "var(--radius-md)",
        cursor: pending ? "default" : "pointer",
        font: "600 14px var(--font-sans)",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Salvataggio…" : "Reimposta password"}
    </button>
  );
}

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPassword, initialState);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--gray-100)",
      }}
    >
      <form
        action={formAction}
        style={{
          width: 360,
          background: "#fff",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
        }}
      >
        <input type="hidden" name="token" value={token} />

        <div
          style={{
            font: "700 16px var(--font-sans)",
            color: "var(--teal-800)",
            marginBottom: 4,
          }}
        >
          Reimposta password
        </div>
        <div
          style={{
            font: "400 12px var(--font-sans)",
            color: "var(--text-secondary)",
            marginBottom: 20,
          }}
        >
          Scegli una nuova password per il tuo account.
        </div>

        <label
          style={{
            display: "block",
            font: "500 13px var(--font-sans)",
            marginBottom: 6,
          }}
        >
          Nuova password
        </label>
        <input
          name="password"
          type="password"
          required
          autoFocus
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            marginBottom: 14,
            font: "400 14px var(--font-sans)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            outline: "none",
          }}
        />

        <label
          style={{
            display: "block",
            font: "500 13px var(--font-sans)",
            marginBottom: 6,
          }}
        >
          Conferma password
        </label>
        <input
          name="confirmPassword"
          type="password"
          required
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            marginBottom: 18,
            font: "400 14px var(--font-sans)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            outline: "none",
          }}
        />

        {state.error && (
          <div
            style={{
              font: "400 13px var(--font-sans)",
              color: "var(--color-error)",
              background: "var(--color-error-bg)",
              borderRadius: "var(--radius-md)",
              padding: "8px 10px",
              marginBottom: 14,
            }}
          >
            {state.error}
          </div>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create the reset-password server page**

Create `src/app/(auth)/reset-password/page.tsx`:

```tsx
import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--gray-100)",
        }}
      >
        <div
          style={{
            width: 360,
            background: "#fff",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: 28,
          }}
        >
          <div
            style={{
              font: "700 16px var(--font-sans)",
              color: "var(--teal-800)",
              marginBottom: 12,
            }}
          >
            Link non valido
          </div>
          <div style={{ font: "400 13px var(--font-sans)", color: "var(--text-secondary)" }}>
            Questo link di reset non è valido o è scaduto. Richiedine uno nuovo dalla pagina di accesso.
          </div>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
```

- [ ] **Step 4: Split the login page into a server wrapper + client form**

Create `src/app/(auth)/login/login-form.tsx` with the full content currently in `src/app/(auth)/login/page.tsx` (the `"use client"` component), renamed from `LoginPage` to `LoginForm`, plus a "Password dimenticata?" link and a success banner read from `useSearchParams`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: "100%",
        height: 40,
        background: "var(--brand)",
        color: "#fff",
        border: "1px solid var(--brand)",
        borderRadius: "var(--radius-md)",
        cursor: pending ? "default" : "pointer",
        font: "600 14px var(--font-sans)",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Accesso in corso…" : "Accedi"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--gray-100)",
      }}
    >
      <form
        action={formAction}
        style={{
          width: 360,
          background: "#fff",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
        }}
      >
        <div
          style={{
            font: "700 16px var(--font-sans)",
            color: "var(--teal-800)",
            marginBottom: 4,
          }}
        >
          Generatore preventivi
        </div>
        <div
          style={{
            font: "400 12px var(--font-sans)",
            color: "var(--text-secondary)",
            marginBottom: 20,
          }}
        >
          DIH Vicenza · accesso staff
        </div>

        {resetSuccess && (
          <div
            style={{
              font: "400 13px var(--font-sans)",
              color: "var(--color-success)",
              background: "var(--color-success-bg)",
              borderRadius: "var(--radius-md)",
              padding: "8px 10px",
              marginBottom: 14,
            }}
          >
            Password reimpostata. Accedi con la nuova password.
          </div>
        )}

        <label
          style={{
            display: "block",
            font: "500 13px var(--font-sans)",
            marginBottom: 6,
          }}
        >
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          autoFocus
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            marginBottom: 14,
            font: "400 14px var(--font-sans)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            outline: "none",
          }}
        />

        <label
          style={{
            display: "block",
            font: "500 13px var(--font-sans)",
            marginBottom: 6,
          }}
        >
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            marginBottom: 18,
            font: "400 14px var(--font-sans)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            outline: "none",
          }}
        />

        {state.error && (
          <div
            style={{
              font: "400 13px var(--font-sans)",
              color: "var(--color-error)",
              background: "var(--color-error-bg)",
              borderRadius: "var(--radius-md)",
              padding: "8px 10px",
              marginBottom: 14,
            }}
          >
            {state.error}
          </div>
        )}

        <SubmitButton />

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <Link
            href="/forgot-password"
            style={{ font: "500 13px var(--font-sans)", color: "var(--brand)" }}
          >
            Password dimenticata?
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Replace `login/page.tsx` with a thin server wrapper**

Replace the full content of `src/app/(auth)/login/page.tsx` with:

```tsx
import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/forgot-password" "src/app/(auth)/reset-password" "src/app/(auth)/login"
git commit -m "Add forgot-password and reset-password pages, link them from login"
```

---

### Task 6: End-to-end verification

**Files:** none (manual verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (in the background, or in a separate terminal)

- [ ] **Step 2: Verify `/forgot-password` with a known seeded user**

Visit `http://localhost:3000/forgot-password`. Submit the seeded admin email (`admin@dihvicenza.it`, or whatever `SEED_ADMIN_EMAIL` resolves to — check `.env`/`prisma/seed.ts` if unsure whether the seed has been run). Confirm:
- The page shows the generic success message.
- Server logs show either a successful Resend call, or — if `RESEND_API_KEY` is still empty — a logged error `Invio email di reset password fallito: Error: RESEND_API_KEY non configurata...` (expected until a real key is configured; the page itself must still show the generic success message, not an error).
- Run `npx prisma studio` (or a one-off query) to confirm a row now exists in `password_reset_tokens` for that user.

- [ ] **Step 3: Verify `/forgot-password` with a non-existent email**

Submit an email you're sure doesn't exist (e.g. `nobody-xyz@test.local`). Confirm the exact same generic message is shown, and no new row appears in `password_reset_tokens`.

- [ ] **Step 4: Verify `/reset-password` end to end**

Take the raw token from Step 2 — since a real email likely wasn't sent (no API key configured yet), read it directly from the server console log if you temporarily add a `console.log(resetUrl)` in `requestPasswordReset`, or query the DB for the token's hash and reconstruct via a throwaway script. (Remove any temporary logging before committing.) Visit `http://localhost:3000/reset-password?token=<raw token>` and confirm:
- The form renders (new password + confirm password fields).
- Submitting a password shorter than 8 characters shows the "almeno 8 caratteri" error.
- Submitting two different passwords shows the "non coincidono" error.
- Submitting a valid, matching password redirects to `/login?reset=success`, which shows the "Password reimpostata" banner.
- Log in with the new password — it works. Log in with the old password — it fails.
- Revisiting the same `/reset-password?token=...` URL and submitting again shows "Link non valido o scaduto."

- [ ] **Step 5: Verify `/reset-password` with no token**

Visit `http://localhost:3000/reset-password` (no query string). Confirm it shows the "Link non valido" message with no form.

- [ ] **Step 6: Run the full automated suite one more time**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Stop the dev server**

If started in the background, stop it now that verification is complete.
