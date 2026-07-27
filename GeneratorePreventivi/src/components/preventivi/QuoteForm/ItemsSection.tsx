"use client";

import { fmt, parseNum } from "@/lib/modules/preventivi/calc";

export type ItemState = {
  key: string;
  catalogItemId: string | null;
  desc: string;
  qty: string;
  price: string;
};

export type CatalogOption = { id: string; description: string; unitPrice: number };

export function ItemsSection({
  items,
  catalog,
  disabled,
  onChange,
}: {
  items: ItemState[];
  catalog: CatalogOption[];
  disabled: boolean;
  onChange: (items: ItemState[]) => void;
}) {
  function updateItem(key: string, patch: Partial<ItemState>) {
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    onChange(items.filter((it) => it.key !== key));
  }

  function addBlank() {
    onChange([...items, { key: crypto.randomUUID(), catalogItemId: null, desc: "", qty: "1", price: "" }]);
  }

  function addFromCatalog(catalogId: string) {
    const c = catalog.find((x) => x.id === catalogId);
    if (!c) return;
    onChange([
      ...items,
      { key: crypto.randomUUID(), catalogItemId: c.id, desc: c.description, qty: "1", price: String(c.unitPrice) },
    ]);
  }

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
        Voci del preventivo
      </h2>

      {items.map((item) => {
        const amount = parseNum(item.qty) * parseNum(item.price);
        return (
          <div
            key={item.key}
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: 12,
              marginBottom: 10,
              background: "var(--gray-50)",
            }}
          >
            <input
              value={item.desc}
              disabled={disabled}
              onChange={(e) => updateItem(item.key, { desc: e.target.value })}
              placeholder="Descrizione voce"
              style={{
                width: "100%",
                height: 36,
                padding: "0 10px",
                marginBottom: 8,
                font: "400 14px var(--font-sans)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
              }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr 34px", gap: 8, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", font: "500 11px var(--font-sans)", color: "var(--text-secondary)", marginBottom: 4 }}>
                  Qtà
                </label>
                <input
                  value={item.qty}
                  disabled={disabled}
                  onChange={(e) => updateItem(item.key, { qty: e.target.value })}
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 8px",
                    textAlign: "right",
                    font: "400 13px var(--font-sans)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", font: "500 11px var(--font-sans)", color: "var(--text-secondary)", marginBottom: 4 }}>
                  Prezzo unit. €
                </label>
                <input
                  value={item.price}
                  disabled={disabled}
                  onChange={(e) => updateItem(item.key, { price: e.target.value })}
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 8px",
                    textAlign: "right",
                    font: "400 13px var(--font-sans)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", font: "500 11px var(--font-sans)", color: "var(--text-secondary)", marginBottom: 4 }}>
                  Importo
                </label>
                <div
                  style={{
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    padding: "0 8px",
                    font: "700 13px var(--font-sans)",
                    color: "var(--teal-800)",
                    background: "var(--teal-50)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {fmt(amount)}
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  title="Rimuovi voce"
                  style={{
                    height: 34,
                    width: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-default)",
                    background: "#fff",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        );
      })}

      {!disabled && (
        <>
          <button
            type="button"
            onClick={addBlank}
            style={{
              width: "100%",
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              margin: "4px 0 12px",
              border: "1px dashed var(--gray-400)",
              background: "#fff",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              font: "600 13px var(--font-sans)",
              color: "var(--teal-700)",
            }}
          >
            + Aggiungi voce manuale
          </button>

          <label style={{ display: "block", font: "500 12px var(--font-sans)", color: "var(--text-secondary)", marginBottom: 6 }}>
            Dal catalogo servizi
          </label>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addFromCatalog(e.target.value);
              e.target.value = "";
            }}
            style={{
              width: "100%",
              height: 40,
              padding: "0 12px",
              font: "400 14px var(--font-sans)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">+ Seleziona un servizio…</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.description} · {fmt(c.unitPrice)}
              </option>
            ))}
          </select>
        </>
      )}
    </section>
  );
}
