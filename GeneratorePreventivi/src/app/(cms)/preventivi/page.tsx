import Link from "next/link";
import { listQuotes } from "@/lib/modules/preventivi/queries";
import { decimalToNumber } from "@/lib/shared/decimal";
import { fmt } from "@/lib/modules/preventivi/calc";
import { deleteDraft } from "@/lib/modules/preventivi/actions";

function formatDate(d: Date) {
  return d.toLocaleDateString("it-IT");
}

export default async function PreventiviPage() {
  const [drafts, issued] = await Promise.all([listQuotes("DRAFT"), listQuotes("ISSUED")]);

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h1 style={{ font: "700 20px var(--font-sans)", color: "var(--teal-800)" }}>Preventivi</h1>
        <Link
          href="/preventivi/new"
          style={{
            height: 38,
            padding: "0 16px",
            display: "inline-flex",
            alignItems: "center",
            background: "var(--brand)",
            color: "#fff",
            borderRadius: "var(--radius-md)",
            font: "600 13px var(--font-sans)",
          }}
        >
          + Nuovo preventivo
        </Link>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ font: "700 13px var(--font-sans)", color: "var(--teal-700)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
          Bozze ({drafts.length})
        </h2>
        <div style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
          {drafts.length === 0 && (
            <div style={{ padding: 16, font: "400 13px var(--font-sans)", color: "var(--text-muted)" }}>
              Nessuna bozza in corso.
            </div>
          )}
          {drafts.map((q) => (
            <div
              key={q.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid var(--gray-200)",
              }}
            >
              <Link href={`/preventivi/${q.id}`} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 14px var(--font-sans)", color: "var(--teal-800)" }}>
                  {q.clientNomeSnap || "(senza cliente)"}
                </div>
                <div style={{ font: "400 12px var(--font-sans)", color: "var(--text-secondary)" }}>
                  {q.title} · aggiornato il {formatDate(q.updatedAt)}
                </div>
              </Link>
              <div style={{ font: "700 13px var(--font-sans)", color: "var(--teal-800)" }}>
                {fmt(decimalToNumber(q.totale))}
              </div>
              <form action={deleteDraft.bind(null, q.id)}>
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
                  Elimina
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ font: "700 13px var(--font-sans)", color: "var(--teal-700)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
          Emessi ({issued.length})
        </h2>
        <div style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
          {issued.length === 0 && (
            <div style={{ padding: 16, font: "400 13px var(--font-sans)", color: "var(--text-muted)" }}>
              Nessun preventivo emesso.
            </div>
          )}
          {issued.map((q) => (
            <Link
              key={q.id}
              href={`/preventivi/${q.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid var(--gray-200)",
              }}
            >
              <div style={{ font: "700 12px var(--font-sans)", color: "var(--teal-700)", minWidth: 70 }}>
                {q.codiceServizio}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 14px var(--font-sans)", color: "var(--teal-800)" }}>
                  {q.clientNomeSnap || "(senza cliente)"}
                </div>
                <div style={{ font: "400 12px var(--font-sans)", color: "var(--text-secondary)" }}>
                  {q.title} · emesso il {q.issuedAt ? formatDate(q.issuedAt) : "—"}
                </div>
              </div>
              <div style={{ font: "700 13px var(--font-sans)", color: "var(--teal-800)" }}>
                {fmt(decimalToNumber(q.totale))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
