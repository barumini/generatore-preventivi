import { notFound } from "next/navigation";
import { getQuote, toQuoteDTO } from "@/lib/modules/preventivi/queries";
import { listClients } from "@/lib/modules/clienti/queries";
import { listActiveCatalogItems } from "@/lib/modules/catalogo/queries";
import { decimalToNumber } from "@/lib/shared/decimal";
import { QuoteEditor } from "@/components/preventivi/QuoteEditor";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const [clients, catalog] = await Promise.all([listClients(), listActiveCatalogItems()]);

  return (
    <QuoteEditor
      initialQuote={toQuoteDTO(quote)}
      clients={clients.map((c) => ({
        id: c.id,
        ragioneSociale: c.ragioneSociale,
        indirizzo: c.indirizzo,
        piva: c.piva,
        codiceSdi: c.codiceSdi,
        referenteDih: c.referenteDih,
        codePrefix: c.codePrefix,
      }))}
      catalog={catalog.map((c) => ({
        id: c.id,
        description: c.description,
        unitPrice: decimalToNumber(c.unitPrice),
      }))}
    />
  );
}
