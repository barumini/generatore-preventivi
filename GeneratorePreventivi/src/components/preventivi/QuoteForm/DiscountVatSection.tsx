"use client";

export function DiscountVatSection({
  sconto,
  iva,
  disabled,
  onChangeSconto,
  onChangeIva,
}: {
  sconto: string;
  iva: string;
  disabled: boolean;
  onChangeSconto: (v: string) => void;
  onChangeIva: (v: string) => void;
}) {
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
        Sconto e IVA
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", font: "500 13px var(--font-sans)", marginBottom: 6 }}>
            Sconto in fattura %
          </label>
          <input
            value={sconto}
            disabled={disabled}
            onChange={(e) => onChangeSconto(e.target.value)}
            inputMode="decimal"
            style={{
              width: "100%",
              height: 38,
              padding: "0 12px",
              textAlign: "right",
              font: "400 14px var(--font-sans)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", font: "500 13px var(--font-sans)", marginBottom: 6 }}>
            Aliquota IVA %
          </label>
          <input
            value={iva}
            disabled={disabled}
            onChange={(e) => onChangeIva(e.target.value)}
            inputMode="decimal"
            style={{
              width: "100%",
              height: 38,
              padding: "0 12px",
              textAlign: "right",
              font: "400 14px var(--font-sans)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
            }}
          />
        </div>
      </div>
      <div style={{ font: "400 12px var(--font-sans)", color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.4 }}>
        Lo sconto in fattura rappresenta il contributo EDIH riconosciuto al cliente.
      </div>
    </section>
  );
}
