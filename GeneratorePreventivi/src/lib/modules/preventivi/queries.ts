import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/shared/decimal";
import type { QuoteDTO } from "./types";

type QuoteWithItems = Awaited<ReturnType<typeof getQuote>>;

export function toQuoteDTO(quote: NonNullable<QuoteWithItems>): QuoteDTO {
  return {
    id: quote.id,
    status: quote.status,
    codiceServizio: quote.codiceServizio,
    issuedAt: quote.issuedAt ? quote.issuedAt.toISOString() : null,
    title: quote.title,
    quoteDate: quote.quoteDate.toISOString().slice(0, 10),
    cup: quote.cup,
    attivitaProgetto: quote.attivitaProgetto,
    clientId: quote.clientId,
    clientNomeSnap: quote.clientNomeSnap,
    clientIndirizzoSnap: quote.clientIndirizzoSnap,
    clientPivaSnap: quote.clientPivaSnap,
    clientSdiSnap: quote.clientSdiSnap,
    clientReferenteSnap: quote.clientReferenteSnap,
    scontoPct: decimalToNumber(quote.scontoPct),
    ivaPct: decimalToNumber(quote.ivaPct),
    imponibile: decimalToNumber(quote.imponibile),
    scontoAmt: decimalToNumber(quote.scontoAmt),
    subtotale: decimalToNumber(quote.subtotale),
    ivaAmt: decimalToNumber(quote.ivaAmt),
    totale: decimalToNumber(quote.totale),
    items: quote.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        id: item.id,
        catalogItemId: item.catalogItemId,
        description: item.description,
        qty: decimalToNumber(item.qty),
        unitPrice: decimalToNumber(item.unitPrice),
        order: item.order,
      })),
  };
}

export function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: { items: true },
  });
}

export function listQuotes(status?: "DRAFT" | "ISSUED") {
  return prisma.quote.findMany({
    where: status ? { status } : undefined,
    include: { items: false },
    orderBy: status === "ISSUED" ? { issuedAt: "desc" } : { updatedAt: "desc" },
  });
}
