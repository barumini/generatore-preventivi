"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/catalog/actions";
import { ErrorBanner } from "@/components/ErrorBanner";

/** Pulsante con conferma; esegue `action` e, se riesce, va a `redirectTo` (o ricarica la pagina). */
export function DeleteButton({
  label = "Elimina",
  confirmText,
  action,
  redirectTo,
  small,
}: {
  label?: string;
  confirmText: string;
  action: () => Promise<ActionResult>;
  redirectTo?: string;
  small?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={`btn btn-danger${small ? " btn-small" : ""}`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          start(async () => {
            const res = await action();
            if (!res.ok) return setError(res.error);
            setError(null);
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          });
        }}
      >
        {label}
      </button>
      {error && <ErrorBanner message={error} />}
    </>
  );
}
