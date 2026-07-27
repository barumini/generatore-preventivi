"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateClient,
  toggleClientActive,
  type ActionResult,
} from "@/lib/modules/clienti/actions";

const initialState: ActionResult | null = null;

const inputStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  font: "400 13px var(--font-sans)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
};

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

export type ClientRowData = {
  id: string;
  ragioneSociale: string;
  indirizzo: string | null;
  piva: string | null;
  codiceSdi: string | null;
  referenteDih: string | null;
  codePrefix: string;
  active: boolean;
};

export function ClientRow({ client }: { client: ClientRowData }) {
  const [editing, setEditing] = useState(false);
  const updateWithId = updateClient.bind(null, client.id);
  const [state, formAction] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const result = await updateWithId(prev, fd);
    if (result.ok) setEditing(false);
    return result;
  }, initialState);

  if (editing) {
    return (
      <tr style={{ borderBottom: "1px solid var(--gray-200)" }}>
        <td colSpan={5} style={{ padding: "12px 4px" }}>
          <form action={formAction}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
              <input name="ragioneSociale" defaultValue={client.ragioneSociale} required style={inputStyle} />
              <input name="codePrefix" defaultValue={client.codePrefix} maxLength={8} style={inputStyle} />
            </div>
            <input
              name="indirizzo"
              defaultValue={client.indirizzo ?? ""}
              style={{ ...inputStyle, width: "100%", marginBottom: 10 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input name="piva" defaultValue={client.piva ?? ""} style={inputStyle} />
              <input name="codiceSdi" defaultValue={client.codiceSdi ?? ""} style={inputStyle} />
              <input name="referenteDih" defaultValue={client.referenteDih ?? ""} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
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
            </div>
          </form>
          {state && !state.ok && (
            <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-error)", marginTop: 8 }}>
              {state.error}
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--gray-200)", opacity: client.active ? 1 : 0.5 }}>
      <td style={{ padding: "10px 4px", font: "600 13px var(--font-sans)", color: "var(--teal-800)" }}>
        {client.ragioneSociale}
      </td>
      <td style={{ padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)" }}>
        {client.codePrefix}
      </td>
      <td style={{ padding: "10px 4px", font: "400 13px var(--font-sans)", color: "var(--text-secondary)" }}>
        {client.piva || "—"}
      </td>
      <td style={{ padding: "10px 4px", textAlign: "center" }}>
        <span
          style={{
            font: "600 11px var(--font-sans)",
            color: client.active ? "var(--color-success)" : "var(--text-muted)",
            background: client.active ? "var(--color-success-bg)" : "var(--gray-100)",
            borderRadius: 999,
            padding: "2px 10px",
          }}
        >
          {client.active ? "Attivo" : "Archiviato"}
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
        <form action={toggleClientActive.bind(null, client.id)} style={{ display: "inline" }}>
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
            {client.active ? "Archivia" : "Riattiva"}
          </button>
        </form>
      </td>
    </tr>
  );
}
