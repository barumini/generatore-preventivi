"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createClient, type ActionResult } from "@/lib/modules/clienti/actions";

const initialState: ActionResult | null = null;

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  font: "400 14px var(--font-sans)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  font: "500 12px var(--font-sans)",
  color: "var(--text-secondary)",
  marginBottom: 6,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        height: 38,
        padding: "0 18px",
        background: "var(--brand)",
        color: "#fff",
        border: "1px solid var(--brand)",
        borderRadius: "var(--radius-md)",
        cursor: pending ? "default" : "pointer",
        font: "600 13px var(--font-sans)",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Salvataggio…" : "+ Aggiungi cliente"}
    </button>
  );
}

export function ClientForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const result = await createClient(prev, fd);
    if (result.ok) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{
        background: "#fff",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Ragione sociale</label>
          <input name="ragioneSociale" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Codice (opzionale, auto-generato)</label>
          <input name="codePrefix" placeholder="es. ROS" maxLength={8} style={inputStyle} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Indirizzo</label>
        <input name="indirizzo" style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>P.IVA</label>
          <input name="piva" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Codice SDI</label>
          <input name="codiceSdi" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Referente DIH</label>
          <input name="referenteDih" style={inputStyle} />
        </div>
      </div>

      {state && !state.ok && (
        <div style={{ font: "400 13px var(--font-sans)", color: "var(--color-error)", marginBottom: 12 }}>
          {state.error}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
