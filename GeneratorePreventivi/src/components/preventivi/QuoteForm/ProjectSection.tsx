"use client";

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
  font: "500 13px var(--font-sans)",
  marginBottom: 6,
};

export function ProjectSection({
  quoteDate,
  cup,
  attivita,
  titolo,
  codiceServizio,
  disabled,
  onChangeQuoteDate,
  onChangeCup,
  onChangeAttivita,
  onChangeTitolo,
}: {
  quoteDate: string;
  cup: string;
  attivita: string;
  titolo: string;
  codiceServizio: string | null;
  disabled: boolean;
  onChangeQuoteDate: (v: string) => void;
  onChangeCup: (v: string) => void;
  onChangeAttivita: (v: string) => void;
  onChangeTitolo: (v: string) => void;
}) {
  return (
    <>
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
          Dati preventivo
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Data</label>
            <input
              type="date"
              value={quoteDate}
              disabled={disabled}
              onChange={(e) => onChangeQuoteDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Codice servizio</label>
            <div
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                background: "var(--gray-50)",
                color: codiceServizio ? "var(--teal-800)" : "var(--text-muted)",
                fontWeight: codiceServizio ? 700 : 400,
              }}
            >
              {codiceServizio ?? "Bozza — assegnato all'emissione"}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>CUP</label>
          <input value={cup} disabled={disabled} onChange={(e) => onChangeCup(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Attività / progetto</label>
          <textarea
            value={attivita}
            disabled={disabled}
            onChange={(e) => onChangeAttivita(e.target.value)}
            rows={2}
            style={{ ...inputStyle, height: "auto", padding: "9px 12px", resize: "vertical", lineHeight: 1.4 }}
          />
        </div>
      </section>

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
          Titolo progetto
        </h2>
        <input
          value={titolo}
          disabled={disabled}
          onChange={(e) => onChangeTitolo(e.target.value)}
          style={{ ...inputStyle, height: 40, font: "700 15px var(--font-sans)", color: "var(--teal-800)" }}
        />
      </section>
    </>
  );
}
