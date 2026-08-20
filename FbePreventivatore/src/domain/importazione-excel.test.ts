import { describe, expect, it } from 'vitest'
import { importaConteggiExcel, type Riga } from './importazione-excel'

// Righe come restituite da un lettore xlsx con {header: 1}: array di righe, ogni riga è
// un array di celle a partire dalla colonna A (indice 0). Riproduce la struttura reale di
// "Conteggi pulito.xlsx" (righe 7-55), verificata con openpyxl durante l'analisi del file.
function rigaVuota(): Riga {
  return []
}

const RIGHE_CRIVELLARO: Riga[] = [
  rigaVuota(),
  rigaVuota(),
  [, , 'Cognome Nome', , , '125+(30+48)/2=164'],
  rigaVuota(),
  [, , 'SERRAMENTI'],
  rigaVuota(),
  [, , 'N°', 'Piano', 'Tipologia', , 'b', 'h'],
  [, , 1, 'PT', 'porta di ingresso', , 1, 2.2],
  [, , 2, 'PT', 'finestra', , 2, 1.8],
  [, , 3, 'PT', 'finestra', , 0.9, 2.2],
  [, , 4, 'PT', 'finestra', , 0.9, 1.2],
  [, , 5, 'PT', 'doppia finestra', , 0.9, 1.2],
  [, , 6, 'PT', 'finestra', , 0.9, 1.2],
  [, , 7, 'PT', 'finestra', , 0.9, 1.2],
  [, , 8, 'PT', 'finestra', , 2.6, 2.2],
  [, , 9, 'PT', 'finestra', , 2.8, 2.2],
  [, , 10, 'PT', 'portafinestra', , 2.2, 2.2],
  [, , 11, 'PT', 'finestra', , 0.8, 2.1],
  rigaVuota(),
  [, , 'COPERTURA', , , , , , , , , 30.5, , , , , 15.89],
  rigaVuota(),
  [, , 1, 'Una falda', , '5,8x16,5 x17,1'],
  [, , 2, 'Una falda', , '5,8x16,5'],
  [, , 3, 'Una falda', , '4,9x6,3'],
  [, , 4, 'Una falda', , '4,9x6,3'],
  [, , 5, 'Pluviali', , '(8)3+(4)2,9'],
  [, , 6, 'Grondaia', , 45.6],
  [, , 7, 'Scossalina', , '33+9,8'],
  rigaVuota(),
  [, , 'TRAVI'],
  rigaVuota(),
  [, , 'Colmo', , , '16,5x0,2x0,32'],
  [, , 'Colmo', , , '6,3x0,2x0,33'],
  [, , 'Pilastri ex', , , '(2)2,7+4,15+(4)2,6+3,8x0,2x0,20'],
  [, , 'Travi ex', , , '(2)3,2+(2)6x0,2x0,24'],
  [, , 'Pilastri int', , , '0,2x0,2'],
  [, , 'travi interne', , , '1,6x0,2x0,24'],
  rigaVuota(),
  [, , 'PARETI'],
  rigaVuota(),
  [, , 'N°', 'I / E', 'b', 'h', 'Sp'],
  [, , 1, 'E', 12.5, 2.7, 20],
  [, , 2, 'E', 10, 3.4, 20],
  [, , 3, 'E', 12.5, 2.7, 20],
  [, , 4, 'E', 10, 3.4, 20],
  [, , 5, 'I', 5.3, 3.75, 16],
]

describe('importaConteggiExcel — SERRAMENTI', () => {
  it('estrae i serramenti con numero, piano, dimensioni e categoria mappata dalla tipologia', () => {
    const risultato = importaConteggiExcel(RIGHE_CRIVELLARO)
    expect(risultato.serramenti).toHaveLength(11)
    expect(risultato.serramenti[0]).toEqual({
      n: 1,
      piano: 'PT',
      tipologia: 'porta di ingresso',
      categoria: 'portoncino',
      b: 1,
      h: 2.2,
    })
    expect(risultato.serramenti[9]).toMatchObject({ tipologia: 'portafinestra', categoria: 'portafinestra-battente' })
  })

  it('mappa "finestra" e "doppia finestra" su finestra-battente', () => {
    const risultato = importaConteggiExcel(RIGHE_CRIVELLARO)
    const categorie = risultato.serramenti.filter((s) => s.tipologia.includes('finestra') && !s.tipologia.includes('porta'))
    expect(categorie.every((s) => s.categoria === 'finestra-battente')).toBe(true)
  })

  it('riproduce il golden case 30,50 mq lordi / 15,89 mq netti (CLAUDE.md)', () => {
    const risultato = importaConteggiExcel(RIGHE_CRIVELLARO)
    const lorda = risultato.serramenti.reduce((somma, s) => somma + s.b * s.h, 0)
    expect(lorda).toBeCloseTo(30.5, 2)
  })

  it('segnala con un avviso una tipologia non riconosciuta, e usa finestra-battente come default', () => {
    const righe: Riga[] = [
      [, , 'SERRAMENTI'],
      rigaVuota(),
      [, , 'N°', 'Piano', 'Tipologia', , 'b', 'h'],
      [, , 1, 'PT', 'oblo rotondo', , 0.5, 0.5],
    ]
    const risultato = importaConteggiExcel(righe)
    expect(risultato.serramenti[0].categoria).toBe('finestra-battente')
    expect(risultato.avvisi.some((a) => a.includes('oblo rotondo'))).toBe(true)
  })

  it('aggiunge un avviso se il totale lordo ricalcolato non coincide con quello dichiarato nel foglio', () => {
    const righe: Riga[] = [
      [, , 'SERRAMENTI'],
      rigaVuota(),
      [, , 'N°', 'Piano', 'Tipologia', , 'b', 'h'],
      [, , 1, 'PT', 'finestra', , 1, 1],
      rigaVuota(),
      [, , 'COPERTURA', , , , , , , , , 99, , , , , 50],
    ]
    const risultato = importaConteggiExcel(righe)
    expect(risultato.avvisi.some((a) => a.toLowerCase().includes('non coincide'))).toBe(true)
  })

  it('non segnala nulla quando il totale ricalcolato coincide con quello del foglio', () => {
    const risultato = importaConteggiExcel(RIGHE_CRIVELLARO)
    expect(risultato.avvisi.some((a) => a.toLowerCase().includes('non coincide'))).toBe(false)
  })
})

describe('importaConteggiExcel — PARETI', () => {
  it('estrae le pareti con numero, tipo interna/esterna, dimensioni e spessore', () => {
    const risultato = importaConteggiExcel(RIGHE_CRIVELLARO)
    expect(risultato.pareti).toHaveLength(5)
    expect(risultato.pareti[0]).toEqual({ n: 1, tipo: 'E', b: 12.5, h: 2.7, spessore: 20 })
    expect(risultato.pareti[4]).toEqual({ n: 5, tipo: 'I', b: 5.3, h: 3.75, spessore: 16 })
  })
})

describe('importaConteggiExcel — COPERTURA e TRAVI (notazione libera)', () => {
  it('conserva etichetta e notazione delle voci di copertura senza tentare di calcolarle', () => {
    const risultato = importaConteggiExcel(RIGHE_CRIVELLARO)
    expect(risultato.falde).toContainEqual({ etichetta: 'Una falda', notazione: '5,8x16,5 x17,1' })
    expect(risultato.falde).toContainEqual({ etichetta: 'Grondaia', notazione: '45.6' })
  })

  it('arrotonda a 2 decimali il rumore in virgola mobile di una cella numerica (es. 45,6 salvato come 45.599999999999994)', () => {
    const righe: Riga[] = [
      [, , 'COPERTURA'],
      rigaVuota(),
      [, , 1, 'Grondaia', , 45.599999999999994],
    ]
    const risultato = importaConteggiExcel(righe)
    expect(risultato.falde).toContainEqual({ etichetta: 'Grondaia', notazione: '45.6' })
  })

  it('conserva etichetta e notazione delle travi', () => {
    const risultato = importaConteggiExcel(RIGHE_CRIVELLARO)
    expect(risultato.travi).toContainEqual({ etichetta: 'Colmo', notazione: '16,5x0,2x0,32' })
    expect(risultato.travi).toContainEqual({
      etichetta: 'Pilastri ex',
      notazione: '(2)2,7+4,15+(4)2,6+3,8x0,2x0,20',
    })
  })
})

describe('importaConteggiExcel — sezioni assenti', () => {
  it('restituisce array vuoti senza errori se una sezione non è presente nel foglio', () => {
    const risultato = importaConteggiExcel([[, , 'SERRAMENTI'], rigaVuota(), [, , 'N°', 'Piano', 'Tipologia', , 'b', 'h']])
    expect(risultato.serramenti).toEqual([])
    expect(risultato.pareti).toEqual([])
    expect(risultato.falde).toEqual([])
    expect(risultato.travi).toEqual([])
  })
})
