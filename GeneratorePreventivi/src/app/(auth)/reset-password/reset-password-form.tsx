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
