import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { leggiRigheDaWorkbook } from './leggi-righe-excel'

async function costruisciBuffer(compila: (foglio: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const foglio = workbook.addWorksheet('Foglio1')
  compila(foglio)
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

describe('leggiRigheDaWorkbook', () => {
  it('riporta le celle di testo e numero alla colonna A come indice 0 (convenzione di importaConteggiExcel)', async () => {
    const buffer = await costruisciBuffer((foglio) => {
      foglio.getCell('C7').value = 'N°'
      foglio.getCell('G8').value = 1.5
    })
    const righe = await leggiRigheDaWorkbook(buffer)
    expect(righe[6][2]).toBe('N°') // riga 7 → indice 6, colonna C → indice 2
    expect(righe[7][6]).toBe(1.5) // riga 8 → indice 7, colonna G → indice 6
  })

  it('risolve una cella formula al suo risultato calcolato', async () => {
    const buffer = await costruisciBuffer((foglio) => {
      foglio.getCell('B1').value = { formula: 'A1', result: 45.6 }
    })
    const righe = await leggiRigheDaWorkbook(buffer)
    expect(righe[0][1]).toBe(45.6)
  })

  it('appiattisce una cella di rich text nel suo testo concatenato', async () => {
    const buffer = await costruisciBuffer((foglio) => {
      foglio.getCell('D3').value = { richText: [{ text: 'Una ' }, { text: 'falda' }] }
    })
    const righe = await leggiRigheDaWorkbook(buffer)
    expect(righe[2][3]).toBe('Una falda')
  })

  it('restituisce un array vuoto per un workbook senza fogli', async () => {
    const workbook = new ExcelJS.Workbook()
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
    const righe = await leggiRigheDaWorkbook(buffer)
    expect(righe).toEqual([])
  })
})
