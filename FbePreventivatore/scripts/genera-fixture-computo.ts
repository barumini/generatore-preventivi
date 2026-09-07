import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { frammentiDaDocumento } from '../src/app/preventivi/conteggi/frammenti-documento'

const RADICE = resolve(import.meta.dirname, '..')
const COMPUTI = [
  ['dacroce', 'Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF'],
  ['crivellaro', 'Documentazione addestramento/Computo Crivellaro rev04.PDF.pdf'],
] as const

for (const [nome, percorso] of COMPUTI) {
  const dati = new Uint8Array(readFileSync(resolve(RADICE, percorso)))
  const documento = await getDocument({ data: dati }).promise
  const frammenti = await frammentiDaDocumento(documento)
  const uscita = resolve(RADICE, `src/domain/computo/fixtures/${nome}.json`)
  mkdirSync(dirname(uscita), { recursive: true })
  writeFileSync(uscita, JSON.stringify(frammenti))
  console.log(`${nome}: ${frammenti.length} frammenti -> ${uscita}`)
}
