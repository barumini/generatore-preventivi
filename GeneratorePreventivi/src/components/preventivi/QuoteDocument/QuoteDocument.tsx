/* eslint-disable @next/next/no-img-element -- print/PDF template, not an LCP-relevant page */
import { DocPage } from "./DocPage";

export type QuoteDocumentItem = {
  desc: string;
  qty: string;
  priceF: string;
  amountF: string;
};

export type QuoteDocumentProps = {
  cliente: string;
  indirizzo: string;
  piva: string;
  sdi: string;
  referente: string;
  data: string;
  codice: string;
  cup: string;
  attivita: string;
  titolo: string;
  items: QuoteDocumentItem[];
  impF: string;
  scontoF: string;
  scontoLabel: string;
  subF: string;
  ivaF: string;
  ivaLabel: string;
  totF: string;
};

const rowLabel: React.CSSProperties = { fontSize: 12 };
const rowValue: React.CSSProperties = { fontSize: 12, fontWeight: 700 };

export function QuoteDocument(props: QuoteDocumentProps) {
  return (
    <DocPage>
      <div style={{ color: "var(--teal-800)", fontFamily: "var(--font-sans)" }}>
        <img src="/assets/logo-dih-vicenza.svg" alt="DIH Vicenza" style={{ height: 90, marginBottom: 26 }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto 1fr",
            columnGap: 20,
            rowGap: 9,
            marginBottom: 30,
          }}
        >
          <div style={rowLabel}>Cliente</div>
          <div style={rowValue}>{props.cliente}</div>
          <div style={rowLabel}>Data</div>
          <div style={rowValue}>{props.data}</div>
          <div style={rowLabel}>Indirizzo</div>
          <div style={rowValue}>{props.indirizzo}</div>
          <div style={rowLabel}>Codice servizio</div>
          <div style={rowValue}>{props.codice}</div>
          <div style={rowLabel}>P.IVA</div>
          <div style={rowValue}>{props.piva}</div>
          <div style={rowLabel}>Referente</div>
          <div style={rowValue}>{props.referente}</div>
          <div style={rowLabel}>SDI</div>
          <div style={rowValue}>{props.sdi}</div>
          <div style={rowLabel}>CUP</div>
          <div style={rowValue}>{props.cup}</div>
          <div style={{ gridColumn: "1 / 2", fontSize: 12 }}>Attività/progetto</div>
          <div style={{ gridColumn: "2 / 5", fontSize: 12 }}>{props.attivita}</div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px", textTransform: "uppercase" }}>
          {props.titolo}
        </h1>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid var(--teal-800)" }}>
              <th style={{ textAlign: "left", padding: "7px 4px", fontWeight: 700 }}>Descrizione</th>
              <th style={{ textAlign: "right", padding: "7px 4px", fontWeight: 700, width: 52 }}>Qtà</th>
              <th style={{ textAlign: "right", padding: "7px 4px", fontWeight: 700, width: 110 }}>Prezzo unit.</th>
              <th style={{ textAlign: "right", padding: "7px 4px", fontWeight: 700, width: 120 }}>Importo</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--gray-200)" }}>
                <td style={{ padding: "8px 4px" }}>{item.desc}</td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>{item.qty}</td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>{item.priceF}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{item.amountF}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 40, marginBottom: 48 }}>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Digital Innovation Hub Vicenza</div>
            <div>F.A.I.V. - Federazione Artigiani Imprenditori Vicentini</div>
            <div>P.IVA: 02371540242</div>
            <div>Sede: Viale Enrico Fermi 134, 36100, Vicenza</div>
            <div>Telefono: 0444 168311</div>
          </div>
          <div style={{ minWidth: 250 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>IMPONIBILE</span>
              <span>{props.impF}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>{props.scontoLabel}</span>
              <span>− {props.scontoF}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                padding: "3px 0",
                fontWeight: 700,
                borderTop: "1px solid var(--gray-300)",
                marginTop: 3,
                paddingTop: 5,
              }}
            >
              <span>SUBTOTALE</span>
              <span>{props.subF}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>{props.ivaLabel}</span>
              <span>{props.ivaF}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                padding: "6px 0 0",
                fontWeight: 700,
                borderTop: "1.5px solid var(--teal-800)",
                marginTop: 4,
              }}
            >
              <span>TOTALE DA PAGARE</span>
              <span>{props.totF}</span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "0 0 40px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <img src="/assets/logo-neural.svg" style={{ height: 32 }} alt="NEURAL" />
            <img src="/assets/logo-edih.svg" style={{ height: 44 }} alt="EDIH" />
            <img src="/assets/logo-g4i.png" style={{ height: 38 }} alt="G4I" />
          </div>
          <div style={{ textAlign: "center", minWidth: 200 }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: 6, fontSize: 13 }}>Firma per accettazione</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 28 }}>
          <img src="/assets/logo-eu-funded.svg" style={{ height: 36 }} alt="EU" />
          <img src="/assets/logo-ministero.png" style={{ height: 32 }} alt="Ministero" />
          <img src="/assets/logo-faiv.png" style={{ height: 26 }} alt="F.A.I.V." />
        </div>
      </div>
    </DocPage>
  );
}
