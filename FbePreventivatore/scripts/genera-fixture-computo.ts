import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { FrammentoTesto } from '../src/domain/computo/frammenti'

const RADICE = resolve(import.meta.dirname, '..')
const COMPUTI = [
  ['dacroce', 'Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF'],
  ['crivellaro', 'Documentazione addestramento/Computo Crivellaro rev04.PDF.pdf'],
] as const

for (const [nome, percorso] of COMPUTI) {
  const dati = new Uint8Array(readFileSync(resolve(RADICE, percorso)))
  const documento = await getDocument({ data: dati }).promise
  const frammenti: FrammentoTesto[] = []
  for (let pagina = 1; pagina <= documento.numPages; pagina++) {
    const contenuto = await (await documento.getPage(pagina)).getTextContent()
    for (const elemento of contenuto.items) {
      const testo = 'str' in elemento ? elemento.str.trim() : ''
      if (!testo) continue
      const t = (elemento as { transform: number[] }).transform
      frammenti.push({ pagina, x: Math.round(t[4]), y: Math.round(t[5]), testo })
    }
  }
  const uscita = resolve(RADICE, `src/domain/computo/fixtures/${nome}.json`)
  mkdirSync(dirname(uscita), { recursive: true })
  writeFileSync(uscita, JSON.stringify(frammenti))
  console.log(`${nome}: ${frammenti.length} frammenti -> ${uscita}`)
}
