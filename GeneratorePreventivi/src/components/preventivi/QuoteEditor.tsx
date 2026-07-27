"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveDraft, issueQuote } from "@/lib/modules/preventivi/actions";
import { duplicateAsDraft } from "@/lib/modules/preventivi/actions";
import { computeTotals, fmt, parseNum } from "@/lib/modules/preventivi/calc";
import type { QuoteDTO, QuoteFormInput } from "@/lib/modules/preventivi/types";
import { ClientSection, type ClientOption } from "./QuoteForm/ClientSection";
import { ProjectSection } from "./QuoteForm/ProjectSection";
import { ItemsSection, type ItemState, type CatalogOption } from "./QuoteForm/ItemsSection";
import { DiscountVatSection } from "./QuoteForm/DiscountVatSection";
import { QuoteDocument } from "./QuoteDocument/QuoteDocument";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function displayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function QuoteEditor({
  initialQuote,
  clients,
  catalog,
}: {
  initialQuote: QuoteDTO | null;
  clients: ClientOption[];
  catalog: CatalogOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [quoteId, setQuoteId] = useState<string | null>(initialQuote?.id ?? null);
  const [status, setStatus] = useState<"DRAFT" | "ISSUED">(initialQuote?.status ?? "DRAFT");
  const [codiceServizio, setCodiceServizio] = useState<string | null>(initialQuote?.codiceServizio ?? null);

  const [clientId, setClientId] = useState(initialQuote?.clientId ?? "");
  const [quoteDate, setQuoteDate] = useState(initialQuote?.quoteDate ?? todayIso());
  const [cup, setCup] = useState(initialQuote?.cup ?? "");
  const [attivita, setAttivita] = useState(initialQuote?.attivitaProgetto ?? "");
  const [titolo, setTitolo] = useState(initialQuote?.title ?? "Titolo progetto");
  const [items, setItems] = useState<ItemState[]>(
    initialQuote?.items.map((it) => ({
      key: it.id,
      catalogItemId: it.catalogItemId,
      desc: it.description,
      qty: String(it.qty),
      price: String(it.unitPrice),
    })) ?? [{ key: crypto.randomUUID(), catalogItemId: null, desc: "", qty: "1", price: "" }]
  );
  const [sconto, setSconto] = useState(initialQuote ? String(initialQuote.scontoPct) : "50");
  const [iva, setIva] = useState(initialQuote ? String(initialQuote.ivaPct) : "22");

  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [printRequest, setPrintRequest] = useState(0);

  const readOnly = status === "ISSUED";

  const totals = useMemo(
    () => computeTotals(items.map((it) => ({ qty: it.qty, price: it.price })), sconto, iva),
    [items, sconto, iva]
  );

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const displayClient = readOnly && initialQuote
    ? {
        ragioneSociale: initialQuote.clientNomeSnap,
        indirizzo: initialQuote.clientIndirizzoSnap,
        piva: initialQuote.clientPivaSnap,
        codiceSdi: initialQuote.clientSdiSnap,
        referenteDih: initialQuote.clientReferenteSnap,
      }
    : selectedClient;

  useEffect(() => {
    if (printRequest > 0) {
      window.print();
    }
  }, [printRequest]);

  function buildInput(): QuoteFormInput {
    return {
      clientId,
      title: titolo,
      quoteDate,
      cup,
      attivitaProgetto: attivita,
      scontoPct: sconto,
      ivaPct: iva,
      items: items.map((it) => ({
        catalogItemId: it.catalogItemId,
        description: it.desc,
        qty: it.qty,
        unitPrice: it.price,
      })),
    };
  }

  function handleSave() {
    setError(null);
    if (!clientId) {
      setError("Seleziona un cliente prima di salvare.");
      return;
    }
    startTransition(async () => {
      const result = await saveDraft(quoteId, buildInput());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyQuote(result.quote);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    });
  }

  function handleIssue() {
    setError(null);
    if (readOnly) {
      setPrintRequest((n) => n + 1);
      return;
    }
    if (!clientId) {
      setError("Seleziona un cliente prima di emettere il preventivo.");
      return;
    }
    startTransition(async () => {
      const result = await issueQuote(quoteId, buildInput());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyQuote(result.quote);
      setPrintRequest((n) => n + 1);
    });
  }

  function applyQuote(quote: QuoteDTO) {
    setQuoteId(quote.id);
    setStatus(quote.status);
    setCodiceServizio(quote.codiceServizio);
    setQuoteDate(quote.quoteDate);
    setTitolo(quote.title);
    setCup(quote.cup ?? "");
    setAttivita(quote.attivitaProgetto);
    setSconto(String(quote.scontoPct));
    setIva(String(quote.ivaPct));
    setItems(
      quote.items.map((it) => ({
        key: it.id,
        catalogItemId: it.catalogItemId,
        desc: it.description,
        qty: String(it.qty),
        price: String(it.unitPrice),
      }))
    );
    if (initialQuote === null) {
      router.replace(`/preventivi/${quote.id}`);
    }
  }

  function handleDuplicate() {
    if (!quoteId) return;
    startTransition(async () => {
      const { id } = await duplicateAsDraft(quoteId);
      router.push(`/preventivi/${id}`);
    });
  }

  const docItems = items.map((it) => {
    const amount = parseNum(it.qty) * parseNum(it.price);
    return { desc: it.desc, qty: it.qty, priceF: fmt(parseNum(it.price)), amountF: fmt(amount) };
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <aside
        className="no-print"
        style={{
          width: 420,
          flex: "none",
          height: "100%",
          overflowY: "auto",
          background: "var(--gray-100)",
          borderRight: "1px solid var(--border-default)",
          padding: "20px 20px 60px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Link href="/preventivi" style={{ font: "500 13px var(--font-sans)", color: "var(--text-secondary)" }}>
            ← Preventivi
          </Link>
          {readOnly && (
            <span
              style={{
                font: "700 11px var(--font-sans)",
                color: "var(--color-success)",
                background: "var(--color-success-bg)",
                borderRadius: 999,
                padding: "3px 10px",
              }}
            >
              Emesso · {codiceServizio}
            </span>
          )}
        </div>

        <ClientSection clients={clients} clientId={clientId} onChangeClientId={setClientId} disabled={readOnly} />
        <ProjectSection
          quoteDate={quoteDate}
          cup={cup}
          attivita={attivita}
          titolo={titolo}
          codiceServizio={codiceServizio}
          disabled={readOnly}
          onChangeQuoteDate={setQuoteDate}
          onChangeCup={setCup}
          onChangeAttivita={setAttivita}
          onChangeTitolo={setTitolo}
        />
        <ItemsSection items={items} catalog={catalog} disabled={readOnly} onChange={setItems} />
        <DiscountVatSection sconto={sconto} iva={iva} disabled={readOnly} onChangeSconto={setSconto} onChangeIva={setIva} />

        {readOnly && (
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isPending}
            style={{
              width: "100%",
              height: 38,
              border: "1px solid var(--border-default)",
              background: "#fff",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              font: "600 13px var(--font-sans)",
              color: "var(--teal-700)",
            }}
          >
            Duplica come nuova bozza
          </button>
        )}

        {error && (
          <div
            style={{
              font: "400 13px var(--font-sans)",
              color: "var(--color-error)",
              background: "var(--color-error-bg)",
              borderRadius: "var(--radius-md)",
              padding: "8px 10px",
              marginTop: 12,
            }}
          >
            {error}
          </div>
        )}
      </aside>

      <main className="cms-main">
        <div
          className="no-print"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(6px)",
            borderBottom: "1px solid var(--border-default)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ font: "600 13px var(--font-sans)", color: "var(--teal-700)" }}>
            {codiceServizio ?? "Bozza"}
          </span>
          <span style={{ font: "400 13px var(--font-sans)", color: "var(--text-secondary)" }}>Anteprima documento</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                style={{
                  height: 36,
                  padding: "0 16px",
                  background: "#fff",
                  color: "var(--teal-700)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  cursor: isPending ? "default" : "pointer",
                  font: "600 14px var(--font-sans)",
                }}
              >
                {justSaved ? "Salvato ✓" : isPending ? "Salvataggio…" : "Salva"}
              </button>
            )}
            <button
              type="button"
              onClick={handleIssue}
              disabled={isPending}
              style={{
                height: 36,
                padding: "0 18px",
                background: "var(--brand)",
                color: "#fff",
                border: "1px solid var(--brand)",
                borderRadius: "var(--radius-md)",
                cursor: isPending ? "default" : "pointer",
                font: "600 14px var(--font-sans)",
              }}
            >
              {isPending ? "Attendere…" : "Scarica PDF"}
            </button>
          </div>
        </div>

        <QuoteDocument
          cliente={displayClient?.ragioneSociale ?? ""}
          indirizzo={displayClient?.indirizzo ?? ""}
          piva={displayClient?.piva ?? ""}
          sdi={displayClient?.codiceSdi ?? ""}
          referente={displayClient?.referenteDih ?? ""}
          data={displayDate(quoteDate)}
          codice={codiceServizio ?? "Bozza"}
          cup={cup}
          attivita={attivita}
          titolo={titolo}
          items={docItems}
          impF={fmt(totals.imponibile)}
          scontoF={fmt(totals.scontoAmt)}
          scontoLabel={`SCONTO IN FATTURA (${parseNum(sconto)}%)`}
          subF={fmt(totals.subtotale)}
          ivaF={fmt(totals.ivaAmt)}
          ivaLabel={`IVA (${parseNum(iva)}%)`}
          totF={fmt(totals.totale)}
        />
      </main>
    </div>
  );
}
