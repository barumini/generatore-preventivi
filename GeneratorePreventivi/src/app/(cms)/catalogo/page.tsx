import { listCatalogItems } from "@/lib/modules/catalogo/queries";
import { decimalToNumber } from "@/lib/shared/decimal";
import { CatalogItemForm } from "@/components/catalogo/CatalogItemForm";
import { CatalogRow } from "@/components/catalogo/CatalogRow";

export default async function CatalogoPage() {
  const items = await listCatalogItems();

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <h1 style={{ font: "700 20px var(--font-sans)", color: "var(--teal-800)", marginBottom: 18 }}>
        Catalogo servizi
      </h1>

      <CatalogItemForm />

      <div style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 4 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid var(--teal-800)" }}>
              <th style={{ textAlign: "left", padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)" }}>Descrizione</th>
              <th style={{ textAlign: "right", padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)", width: 120 }}>Prezzo</th>
              <th style={{ textAlign: "center", padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)", width: 100 }}>Stato</th>
              <th style={{ width: 160 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <CatalogRow
                key={item.id}
                item={{
                  id: item.id,
                  description: item.description,
                  unitPrice: decimalToNumber(item.unitPrice),
                  active: item.active,
                }}
              />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "20px 4px", textAlign: "center", font: "400 13px var(--font-sans)", color: "var(--text-muted)" }}>
                  Nessuna voce nel catalogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
