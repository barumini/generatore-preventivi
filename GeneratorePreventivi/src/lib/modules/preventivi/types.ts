export type QuoteItemInput = {
  catalogItemId: string | null;
  description: string;
  qty: string;
  unitPrice: string;
};

export type QuoteFormInput = {
  clientId: string;
  title: string;
  quoteDate: string; // yyyy-mm-dd
  cup: string;
  attivitaProgetto: string;
  scontoPct: string;
  ivaPct: string;
  items: QuoteItemInput[];
};

export type QuoteItemDTO = {
  id: string;
  catalogItemId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  order: number;
};

export type QuoteDTO = {
  id: string;
  status: "DRAFT" | "ISSUED";
  codiceServizio: string | null;
  issuedAt: string | null;
  title: string;
  quoteDate: string;
  cup: string | null;
  attivitaProgetto: string;
  clientId: string;
  clientNomeSnap: string;
  clientIndirizzoSnap: string | null;
  clientPivaSnap: string | null;
  clientSdiSnap: string | null;
  clientReferenteSnap: string | null;
  scontoPct: number;
  ivaPct: number;
  imponibile: number;
  scontoAmt: number;
  subtotale: number;
  ivaAmt: number;
  totale: number;
  items: QuoteItemDTO[];
};
