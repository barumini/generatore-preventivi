import { listClients } from "@/lib/modules/clienti/queries";
import { ClientForm } from "@/components/clienti/ClientForm";
import { ClientRow } from "@/components/clienti/ClientRow";

export default async function ClientiPage() {
  const clients = await listClients();

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>
      <h1 style={{ font: "700 20px var(--font-sans)", color: "var(--teal-800)", marginBottom: 18 }}>
        Anagrafica clienti
      </h1>

      <ClientForm />

      <div style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 4 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid var(--teal-800)" }}>
              <th style={{ textAlign: "left", padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)" }}>Ragione sociale</th>
              <th style={{ textAlign: "left", padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)", width: 90 }}>Codice</th>
              <th style={{ textAlign: "left", padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)", width: 140 }}>P.IVA</th>
              <th style={{ textAlign: "center", padding: "10px 4px", font: "700 12px var(--font-sans)", color: "var(--teal-700)", width: 100 }}>Stato</th>
              <th style={{ width: 160 }} />
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <ClientRow key={client.id} client={client} />
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "20px 4px", textAlign: "center", font: "400 13px var(--font-sans)", color: "var(--text-muted)" }}>
                  Nessun cliente in anagrafica.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
