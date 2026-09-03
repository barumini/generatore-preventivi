import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs'
import type { FrammentoTesto } from '@/domain/computo/frammenti'

// Copiato in public/ da `npm run copia-worker-pdf` (predev/prebuild).
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export async function frammentiDaPdf(sorgente: ArrayBuffer): Promise<FrammentoTesto[]> {
  const documento = await getDocument({ data: new Uint8Array(sorgente) }).promise
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
