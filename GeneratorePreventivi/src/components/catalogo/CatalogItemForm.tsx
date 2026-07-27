"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createCatalogItem, type ActionResult } from "@/lib/modules/catalogo/actions";

const initialState: ActionResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        height: 38,
        padding: "0 16px",
        background: "var(--brand)",
        color: "#fff",
        border: "1px solid var(--brand)",
        borderRadius: "var(--radius-md)",
        cursor: pending ? "default" : "pointer",
        font: "600 13px var(--font-sans)",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Aggiunta…" : "+ Aggiungi voce"}
    </button>
  );
}

export function CatalogItemForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const result = await createCatalogItem(prev, fd);
    if (result.ok) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: "#fff",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        marginBottom: 18,
      }}
    >
      <div style={{ flex: 1 }}>
        <input
          name="description"
          placeholder="Descrizione servizio"
          required
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            font: "400 14px var(--font-sans)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            outline: "none",
          }}
        />
        {state && !state.ok && (
          <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-error)", marginTop: 6 }}>
            {state.error}
          </div>
        )}
      </div>
      <input
        name="unitPrice"
        type="number"
        step="0.01"
        min="0"
        placeholder="Prezzo €"
        required
        style={{
          width: 140,
          height: 38,
          padding: "0 12px",
          textAlign: "right",
          font: "400 14px var(--font-sans)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          outline: "none",
        }}
      />
      <SubmitButton />
    </form>
  );
}
