import ExcelJS from 'exceljs'
import type { Cella, Riga } from '@/domain/importazione-excel'

function normalizzaCella(valore: ExcelJS.CellValue): Cella {
  if (valore === null || valore === undefined) return null
  if (typeof valore === 'number' || typeof valore === 'string') return valore
  if (valore instanceof Date) return valore.toISOString()
  if (typeof valore === 'object') {
    if ('richText' in valore) return valore.richText.map((parte) => parte.text).join('')
    if ('result' in valore) return normalizzaCella(valore.result ?? null)
    if ('text' in valore) return String((valore as { text: unknown }).text)
  }
  return String(valore)
}

// row.values di ExcelJS è indicizzato da 1 (indice 0 sempre vuoto, per convenzione della
// libreria). importaConteggiExcel si aspetta invece la colonna A all'indice 0 — da qui lo
// slice(1), l'unico punto in cui questa differenza va gestita.
export async function leggiRigheDaWorkbook(buffer: ArrayBuffer): Promise<Riga[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const foglio = workbook.worksheets[0]
  if (!foglio) return []

  const righe: Riga[] = []
  foglio.eachRow({ includeEmpty: true }, (row, numeroRiga) => {
    const valori = row.values as ExcelJS.CellValue[]
    righe[numeroRiga - 1] = valori.slice(1).map(normalizzaCella)
  })
  return righe
}
