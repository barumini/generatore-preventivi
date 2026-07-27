"use client";

import Link from "next/link";

export type ClientOption = {
  id: string;
  ragioneSociale: string;
  indirizzo: string | null;
  piva: string | null;
  codiceSdi: string | null;
  referenteDih: string | null;
  codePrefix: string;
};

const fieldStyle: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)" };
const valueStyle: React.CSSProperties = { font: "600 13px var(--font-sans)", color: "var(--teal-800)", marginBottom: 8 };

export function ClientSection({
  clients,
  clientId,
  onChangeClientId,
  disabled,
}: {
  clients: ClientOption[];
  clientId: string;
  onChangeClientId: (id: string) => void;
  disabled: boolean;
}) {
  const selected = clients.find((c) => c.id === clientId) ?? null;

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        marginBottom: 16,
      }}
    >
      <h2
        style={{
          font: "700 12px var(--font-sans)",
          letterSpacing: ".07em",
          textTransform: "uppercase",
          color: "var(--teal-700)",
          margin: "0 0 14px",
        }}
      >
        Dati cliente
      </h2>

      <label style={{ display: "block", font: "500 13px var(--font-sans)", marginBottom: 6 }}>Cliente</label>
      <select
        value={clientId}
        disabled={disabled}
        onChange={(e) => onChangeClientId(e.target.value)}
        style={{
          width: "100%",
          height: 38,
          padding: "0 12px",
          marginBottom: 12,
          font: "400 14px var(--font-sans)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          outline: "none",
        }}
      >
        <option value="">— Seleziona un cliente —</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.ragioneSociale} ({c.codePrefix})
          </option>
        ))}
      </select>

      {selected && (
        <div style={{ background: "var(--gray-50)", borderRadius: "var(--radius-md)", padding: 12 }}>
          <div style={fieldStyle}>Indirizzo</div>
          <div style={valueStyle}>{selected.indirizzo || "—"}</div>
          <div style={fieldStyle}>P.IVA</div>
          <div style={valueStyle}>{selected.piva || "—"}</div>
          <div style={fieldStyle}>Codice SDI</div>
          <div style={valueStyle}>{selected.codiceSdi || "—"}</div>
          <div style={fieldStyle}>Referente DIH</div>
          <div style={{ ...valueStyle, marginBottom: 0 }}>{selected.referenteDih || "—"}</div>
        </div>
      )}

      <Link
        href="/clienti"
        style={{ display: "inline-block", marginTop: 10, font: "500 12px var(--font-sans)", color: "var(--accent-blue)" }}
      >
        Gestisci anagrafica clienti →
      </Link>
    </section>
  );
}
