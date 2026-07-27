import { StatCard } from "@/components/dashboard/StatCard";
import { fmt } from "@/lib/modules/preventivi/calc";
import {
  getStatusCounts,
  getIssuedTotalsSummary,
  getMonthlyTotals,
  getTopCatalogItems,
  getTopClients,
} from "@/lib/modules/dashboard/queries";

const MONTH_LABELS = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: 18,
};

export default async function DashboardPage() {
  const [statusCounts, issuedSummary, monthly, topCatalog, topClients] = await Promise.all([
    getStatusCounts(),
    getIssuedTotalsSummary(),
    getMonthlyTotals(6),
    getTopCatalogItems(5),
    getTopClients(5),
  ]);

  const maxMonthly = Math.max(1, ...monthly.map((m) => m.total));

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ font: "700 20px var(--font-sans)", color: "var(--teal-800)", marginBottom: 18 }}>Dashboard</h1>

      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Bozze in corso" value={String(statusCounts.draft)} />
        <StatCard label="Preventivi emessi" value={String(issuedSummary.count)} />
        <StatCard label="Totale emesso" value={fmt(issuedSummary.totalValue)} />
        <StatCard label="Valore medio" value={fmt(issuedSummary.avgValue)} hint="per preventivo emesso" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <h2 style={{ font: "700 12px var(--font-sans)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--teal-700)", margin: "0 0 14px" }}>
            Totale emesso per mese
          </h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
            {monthly.map((m) => (
              <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ font: "600 11px var(--font-sans)", color: "var(--text-secondary)" }}>
                  {m.total > 0 ? fmt(m.total) : "—"}
                </div>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 36,
                    height: Math.max(2, (m.total / maxMonthly) * 100),
                    background: "var(--teal-600)",
                    borderRadius: "3px 3px 0 0",
                  }}
                />
                <div style={{ font: "500 11px var(--font-sans)", color: "var(--text-muted)" }}>{monthLabel(m.month)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ font: "700 12px var(--font-sans)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--teal-700)", margin: "0 0 14px" }}>
            Servizi più richiesti
          </h2>
          {topCatalog.length === 0 && (
            <div style={{ font: "400 13px var(--font-sans)", color: "var(--text-muted)" }}>Nessun dato disponibile.</div>
          )}
          {topCatalog.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < topCatalog.length - 1 ? "1px solid var(--gray-200)" : "none" }}>
              <span style={{ font: "400 13px var(--font-sans)", color: "var(--text-primary)" }}>{item.description}</span>
              <span style={{ font: "700 13px var(--font-sans)", color: "var(--teal-700)" }}>{item.count}×</span>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ font: "700 12px var(--font-sans)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--teal-700)", margin: "0 0 14px" }}>
          Top clienti per valore
        </h2>
        {topClients.length === 0 && (
          <div style={{ font: "400 13px var(--font-sans)", color: "var(--text-muted)" }}>Nessun dato disponibile.</div>
        )}
        {topClients.map((c, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < topClients.length - 1 ? "1px solid var(--gray-200)" : "none" }}>
            <span style={{ font: "600 13px var(--font-sans)", color: "var(--teal-800)" }}>{c.ragioneSociale}</span>
            <span style={{ font: "400 12px var(--font-sans)", color: "var(--text-secondary)" }}>{c.count} preventivi</span>
            <span style={{ font: "700 13px var(--font-sans)", color: "var(--teal-700)" }}>{fmt(c.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
