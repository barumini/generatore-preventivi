import { listActiveClients } from "@/lib/modules/clienti/queries";
import { listActiveCatalogItems } from "@/lib/modules/catalogo/queries";
import { decimalToNumber } from "@/lib/shared/decimal";
import { QuoteEditor } from "@/components/preventivi/QuoteEditor";

export default async function NewQuotePage() {
  const [clients, catalog] = await Promise.all([listActiveClients(), listActiveCatalogItems()]);

  return (
    <QuoteEditor
      initialQuote={null}
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
