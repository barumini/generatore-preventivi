import type { FrammentoTesto } from '@/domain/computo/frammenti'
import { frammentiDaDocumento } from './frammenti-documento'

export async function frammentiDaPdf(sorgente: ArrayBuffer): Promise<FrammentoTesto[]> {
  // Import dinamico e non in testa al modulo: la sola valutazione di
  // `pdf.mjs` (non l'uso) referenzia `DOMMatrix`, un'API del browser. Next
  // valuta comunque i moduli dei client component lato server per l'HTML
  // iniziale, quindi un import statico fa fallire ogni render di questa
  // pagina con "DOMMatrix is not defined". Rimandare l'import a quando la
  // funzione viene davvero chiamata (solo nel browser, dal gestore
  // dell'input file) evita che il modulo venga toccato durante l'SSR.
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/build/pdf.mjs')
  // Copiato in public/ da `npm run copia-worker-pdf` (predev/prebuild).
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const documento = await getDocument({ data: new Uint8Array(sorgente) }).promise
  return frammentiDaDocumento(documento)
}
