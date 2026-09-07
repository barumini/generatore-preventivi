import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FrammentoTesto } from '@/domain/computo/frammenti'

/**
 * Il loop di estrazione condiviso fra l'adattatore browser (leggi-pdf.ts, che
 * ottiene `documento` con l'import dinamico di `pdfjs-dist/build/pdf.mjs` più
 * il worker) e lo script di rigenerazione fixture (scripts/genera-fixture-computo.ts,
 * che lo ottiene dalla build `legacy` in Node). Quelle due differenze sono le
 * uniche legittime e restano fuori da qui: come si arriva a `documento`, non
 * come lo si legge.
 *
 * Solo un `import type`, quindi nessun costo a runtime: la sola valutazione di
 * `pdfjs-dist` (non l'uso) referenzia `DOMMatrix`, un'API del browser, e un
 * import statico di questo modulo da leggi-pdf.ts deve restare sicuro anche
 * lato server durante l'SSR.
 */
export async function frammentiDaDocumento(documento: PDFDocumentProxy): Promise<FrammentoTesto[]> {
  const frammenti: FrammentoTesto[] = []
  for (let pagina = 1; pagina <= documento.numPages; pagina++) {
    const contenuto = await (await documento.getPage(pagina)).getTextContent()
    for (const elemento of contenuto.items) {
      const testo = 'str' in elemento ? elemento.str.trim() : ''
      if (!testo) continue
      const trasformazione = (elemento as { transform: number[] }).transform
      frammenti.push({
        pagina,
        x: Math.round(trasformazione[4]),
        y: Math.round(trasformazione[5]),
        testo,
      })
    }
  }
  return frammenti
}
