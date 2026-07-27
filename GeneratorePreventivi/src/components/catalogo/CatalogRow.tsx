"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateCatalogItem,
  toggleCatalogItemActive,
  type ActionResult,
} from "@/lib/modules/catalogo/actions";
import { fmt } from "@/lib/modules/preventivi/calc";

const initialState: ActionResult | null = null;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        height: 32,
        padding: "0 12px",
        background: "var(--brand)",
        color: "#fff",
        border: "1px solid var(--brand)",
        borderRadius: "var(--radius-sm)",
        cursor: pending ? "default" : "pointer",
        font: "600 12px var(--font-sans)",
      }}
    >
      {pending ? "Salvataggio…" : "Salva"}
    </button>
  );
}

export function CatalogRow({
  item,
}: {
  item: { id: string; description: string; unitPrice: number; active: boolean };
}) {
  const [editing, setEditing] = useState(false);
  const updateWithId = updateCatalogItem.bind(null, item.id);
  const [state, formAction] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const result = await updateWithId(prev, fd);
    if (result.ok) setEditing(false);
    return result;
  }, initialState);

  if (editing) {
    return (
      <tr style={{ borderBottom: "1px solid var(--gray-200)" }}>
        <td colSpan={4} style={{ padding: "10px 4px" }}>
          <form action={formAction} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input
              name="description"
              defaultValue={item.description}
              required
              style={{
                flex: 1,
                height: 34,
                padding: "0 10px",
                font: "400 13px var(--font-sans)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            />
            <input
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={item.unitPrice}
              required
              style={{
                width: 120,
                height: 34,
                padding: "0 10px",
                textAlign: "right",
                font: "400 13px var(--font-sans)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            />
            <SaveButton />
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{
                height: 32,
                padding: "0 12px",
                background: "#fff",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                font: "500 12px var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              Annulla
            </button>
          </form>
          {state && !state.ok && (
            <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-error)", marginTop: 6 }}>
              {state.error}
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--gray-200)", opacity: item.active ? 1 : 0.5 }}>
      <td style={{ padding: "10px 4px", font: "400 14px var(--font-sans)" }}>{item.description}</td>
      <td style={{ padding: "10px 4px", textAlign: "right", font: "600 14px var(--font-sans)", color: "var(--teal-800)" }}>
        {fmt(item.unitPrice)}
      </td>
      <td style={{ padding: "10px 4px", textAlign: "center" }}>
        <span
          style={{
            font: "600 11px var(--font-sans)",
            color: item.active ? "var(--color-success)" : "var(--text-muted)",
            background: item.active ? "var(--color-success-bg)" : "var(--gray-100)",
            borderRadius: 999,
            padding: "2px 10px",
          }}
        >
          {item.active ? "Attivo" : "Archiviato"}
        </span>
      </td>
      <td style={{ padding: "10px 4px", textAlign: "right", whiteSpace: "nowrap" }}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            height: 30,
            padding: "0 10px",
            marginRight: 6,
            background: "#fff",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            font: "500 12px var(--font-sans)",
            color: "var(--teal-700)",
          }}
        >
          Modifica
        </button>
        <form action={toggleCatalogItemActive.bind(null, item.id)} style={{ display: "inline" }}>
          <button
            type="submit"
            style={{
              height: 30,
              padding: "0 10px",
              background: "#fff",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              font: "500 12px var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            {item.active ? "Archivia" : "Riattiva"}
          </button>
        </form>
      </td>
    </tr>
  );
}
