"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/catalog/actions";
import { ErrorBanner } from "@/components/ErrorBanner";

/**
 * Pulsante con conferma nella pagina; esegue `action` e, se riesce, va a `redirectTo`
 * (o ricarica la pagina). Niente window.confirm: alcuni browser integrati (come il
 * riquadro browser dell'app Claude) non mostrano la finestra e rispondono subito "no",
 * e il pulsante sembrava non fare nulla.
 */
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
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = small ? " btn-small" : "";

  if (!asking) {
    return (
      <>
        <button
          type="button"
          className={`btn btn-danger${size}`}
          onClick={() => {
            setError(null);
            setAsking(true);
          }}
        >
          {label}
        </button>
        {error && <ErrorBanner message={error} />}
      </>
    );
  }

  return (
    <div className="confirm-delete" role="alertdialog" aria-label={label}>
      <p>{confirmText}</p>
      <div className="row">
        <button
          type="button"
          className={`btn btn-danger${size}`}
          disabled={pending}
          autoFocus
          onClick={() =>
            start(async () => {
              const res = await action();
              if (!res.ok) {
                setAsking(false);
                setError(res.error);
                return;
              }
              if (redirectTo) router.push(redirectTo);
              else {
                setAsking(false);
                router.refresh();
              }
            })
          }
        >
          {pending ? "Eliminazione…" : "Sì, elimina"}
        </button>
        <button type="button" className={`btn${size}`} disabled={pending} onClick={() => setAsking(false)}>
          Annulla
        </button>
      </div>
    </div>
  );
}
