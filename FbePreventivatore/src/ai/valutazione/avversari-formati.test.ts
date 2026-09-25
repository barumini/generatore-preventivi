import { describe, expect, it } from 'vitest'
import type { CampiEstratti } from '../estrazione'
import { valutaCaso, type CasoValutazione } from '../valutazione-estrazione'
import { CASI_AVVERSARI_FORMATI } from './avversari-formati'

// Risposte ideali per i casi di avversari-formati.ts: ogni controllo deve passare su queste.
// Più alcune risposte sbagliate "tipiche" (cm lasciati, unità nel valore, somma risolta...)
// che devono essere bocciate dal controllo mirato: verificano che i controlli discriminino.

const MANCANTI_FABBRICATO = ['tipoCopertura', 'finituraEsterna', 'pacchetto']

const IDEALI: Record<string, CampiEstratti> = {
  'R-F1-serramenti-formati-misti': {
    cliente: { nome: 'Pegoraro Silvana', comune: 'Montecchio Precalcino', provincia: 'VI' },
    protocollo: '2026114',
    superfici: [],
    serramenti: [
      { n: 1, piano: 'Piano Terra', tipologia: "porta d'ingresso", categoria: 'portoncino', b: 1.2, h: 2.4 },
      { n: 2, piano: 'Piano Terra', tipologia: 'finestra cucina', categoria: 'finestra-battente', b: 0.9, h: 1.4 },
      { n: 3, piano: 'Piano Primo', tipologia: 'portafinestra camera', categoria: 'portafinestra-battente', b: 0.8, h: 2.3 },
      { n: 4, piano: 'Piano Terra', tipologia: 'vetrata fissa soggiorno', categoria: 'fisso-vetrata', b: 2.5, h: 2.7 },
      { n: 5, piano: 'Piano Primo', tipologia: 'finestra bagno', categoria: 'finestra-battente', b: 0.6, h: 0.6 },
    ],
    campiMancanti: [
      'progettista',
      'superfici',
      ...MANCANTI_FABBRICATO,
      'spessoreEsterno',
      'spessoreInterno',
      'spessoreCoibente',
      'spessoreCappotto',
    ],
  },
  'R-F2-superfici-unita-e-spessori-composti': {
    cliente: { nome: 'Lovato Ermes', comune: 'Sarcedo', provincia: 'VI' },
    protocollo: '2026131',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '20+15+8' },
      { piano: 'Piano Primo', valoreLordo: '96,40' },
      { piano: 'Portico', valoreLordo: '12' },
      { piano: 'Terrazzo', valoreLordo: '7.5' },
    ],
    spessoreEsterno: '160+60',
    spessoreInterno: '120-100',
    spessoreCoibente: '140',
    spessoreCappotto: '80+60',
    campiMancanti: ['progettista', ...MANCANTI_FABBRICATO],
  },
  'R-F3-pareti-formati-e-falde-complesse': {
    cliente: { nome: 'Cecchetto Loris', comune: 'Breganze', provincia: 'VI' },
    superfici: [],
    tipoCopertura: 'falde',
    pareti: [
      { n: 1, tipo: 'E', b: 3, h: 2.5, spessore: 205 },
      { n: 2, tipo: 'E', b: 7.4, h: 2.8, spessore: 160 },
      { n: 4, tipo: 'I', b: 3.6, h: 2.5, spessore: 100 },
    ],
    falde: [
      { etichetta: 'falda A', notazione: '(8,40+2x0,60) x 5,95' },
      { etichetta: 'falda B', notazione: '4,20x5,95 + 1/2x2,10x1,80' },
    ],
    travi: [{ etichetta: 'trave di colmo', notazione: '20x28 cm lunghezza 10,60 m' }],
    campiMancanti: ['protocollo', 'progettista', 'superfici', 'finituraEsterna', 'pacchetto', 'spessoreEsterno'],
  },
  'R-F4-misure-corrette-a-turni': {
    cliente: { nome: 'Marangon Tiziano', comune: 'Caldogno', provincia: 'VI' },
    progettista: 'geom. Walter Faggion',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '110+6' },
      { piano: 'Garage', valoreLordo: '28' },
    ],
    spessoreEsterno: '160+40',
    serramenti: [
      { n: 1, piano: 'Piano Terra', tipologia: 'portoncino', categoria: 'portoncino', b: 1.1, h: 2.3 },
      { n: 2, piano: 'Piano Primo', tipologia: 'portafinestra', categoria: 'portafinestra-battente', b: 1.6, h: 2.4 },
    ],
    campiMancanti: ['protocollo', ...MANCANTI_FABBRICATO, 'spessoreInterno', 'spessoreCoibente', 'spessoreCappotto'],
  },
}

// Varianti sbagliate: [caso, descrizione, controllo che DEVE bocciarla, trasformazione].
type Mutazione = [string, string, string, (c: CampiEstratti) => CampiEstratti]
const copia = (c: CampiEstratti): CampiEstratti => structuredClone(c)

const MUTAZIONI: Mutazione[] = [
  ['R-F1-serramenti-formati-misti', 'portoncino lasciato in cm', 'portoncino "120x240 cm" riportato in metri: 1.2 x 2.4',
    (c) => { const x = copia(c); x.serramenti![0] = { ...x.serramenti![0], b: 120, h: 240 }; return x }],
  ['R-F1-serramenti-formati-misti', 'finestra bagno lasciata in mm', 'finestra "600x600 mm" riportata in metri: 0.6 x 0.6',
    (c) => { const x = copia(c); x.serramenti![4] = { ...x.serramenti![4], b: 600, h: 600 }; return x }],
  ['R-F1-serramenti-formati-misti', 'alzante con altezza inventata', 'alzante con la sola larghezza omesso',
    (c) => { const x = copia(c); x.serramenti!.push({ n: 6, piano: 'PT', tipologia: 'alzante scorrevole', categoria: 'alzante-scorrevole', b: 3.2, h: 2.4 }); return x }],
  ['R-F1-serramenti-formati-misti', 'vetrata L/H scambiati', 'vetrata fissa "L=2,50 H=2,70" con virgola decimale: 2.5 x 2.7',
    (c) => { const x = copia(c); x.serramenti![3] = { ...x.serramenti![3], b: 2.7, h: 2.5 }; return x }],
  ['R-F2-superfici-unita-e-spessori-composti', 'somma PT risolta a 43', 'Piano Terra "20+15+8 m2": somma conservata, senza unità',
    (c) => { const x = copia(c); x.superfici[0].valoreLordo = '43'; return x }],
  ['R-F2-superfici-unita-e-spessori-composti', 'unità m² rimasta nel valore', 'Piano Primo "96,40 m²": decimale conservato, senza unità',
    (c) => { const x = copia(c); x.superfici[1].valoreLordo = '96,40 m²'; return x }],
  ['R-F2-superfici-unita-e-spessori-composti', 'unità m² rimasta (controllo globale)', 'quattro superfici, nessuna con l\'unità nel valore',
    (c) => { const x = copia(c); x.superfici[3].valoreLordo = '7.5 m2'; return x }],
  ['R-F2-superfici-unita-e-spessori-composti', 'spessore composto sommato', 'spessori composti con "+" come scritti, senza "mm"',
    (c) => { const x = copia(c); x.spessoreEsterno = '220'; return x }],
  ['R-F2-superfici-unita-e-spessori-composti', 'mm lasciati nello spessore', 'spessori composti con "+" come scritti, senza "mm"',
    (c) => { const x = copia(c); x.spessoreCappotto = '80+60mm'; return x }],
  ['R-F2-superfici-unita-e-spessori-composti', 'intervallo risolto nella media', 'intervallo "120-100" non risolto, coibente semplice "140"',
    (c) => { const x = copia(c); x.spessoreInterno = '110'; return x }],
  ['R-F2-superfici-unita-e-spessori-composti', 'superfici segnalate mancanti', 'superfici e spessori non segnalati mancanti',
    (c) => { const x = copia(c); x.campiMancanti.push('superfici'); return x }],
  ['R-F3-pareti-formati-e-falde-complesse', 'parete senza spessore con valore inventato', 'parete interna senza spessore omessa',
    (c) => { const x = copia(c); x.pareti!.push({ n: 3, tipo: 'I', b: 4.15, h: 2.5, spessore: 100 }); return x }],
  ['R-F3-pareti-formati-e-falde-complesse', 'trave trattata come parete', 'esattamente tre pareti (la trave non è una parete)',
    (c) => { const x = copia(c); x.pareti!.push({ n: 5, tipo: 'I', b: 10.6, h: 0.28, spessore: 200 }); return x }],
  ['R-F3-pareti-formati-e-falde-complesse', 'falda A calcolata', 'falda con parentesi e moltiplicatore riportata testualmente',
    (c) => { const x = copia(c); x.falde![0].notazione = '57,12'; return x }],
  ['R-F3-pareti-formati-e-falde-complesse', 'falda B con × al posto di x', 'falda con somma e frazione riportata testualmente',
    (c) => { const x = copia(c); x.falde![1].notazione = '4,20×5,95 + 1/2×2,10×1,80'; return x }],
  ['R-F3-pareti-formati-e-falde-complesse', 'spessore parete in cm', 'parete "L=3,00 H=2,50 sp. 205 mm": E 3 x 2.5, spessore 205',
    (c) => { const x = copia(c); x.pareti![0] = { ...x.pareti![0], spessore: 20.5 }; return x }],
  ['R-F4-misure-corrette-a-turni', 'portoncino vecchio tenuto', 'un solo portoncino, con l\'ultima misura "1,10 x 2,30 m"',
    (c) => { const x = copia(c); x.serramenti!.push({ n: 3, piano: 'PT', tipologia: 'portoncino', categoria: 'portoncino', b: 1, h: 2.2 }); return x }],
  ['R-F4-misure-corrette-a-turni', 'portafinestra omessa nonostante il secondo turno', 'portafinestra completata al secondo turno: 1.6 x 2.4',
    (c) => { const x = copia(c); x.serramenti = x.serramenti!.filter((s) => s.categoria !== 'portafinestra-battente'); return x }],
  ['R-F4-misure-corrette-a-turni', 'PT risolto a 116', 'Piano Terra aggiornato alla somma scritta "110+6"',
    (c) => { const x = copia(c); x.superfici[0].valoreLordo = '116'; return x }],
  ['R-F4-misure-corrette-a-turni', 'PT duplicato (vecchio e nuovo)', 'Garage "28 mq" -> "28" e nessun piano duplicato',
    (c) => { const x = copia(c); x.superfici.push({ piano: 'Piano Terra', valoreLordo: '110' }); return x }],
  ['R-F4-misure-corrette-a-turni', 'spessore vecchio tenuto', 'spessore esterno corretto a "160+40"',
    (c) => { const x = copia(c); x.spessoreEsterno = '200'; return x }],
]

function caso(id: string): CasoValutazione {
  const trovato = CASI_AVVERSARI_FORMATI.find((c) => c.id === id)
  if (!trovato) throw new Error(`caso ${id} assente`)
  return trovato
}

function bocciati(id: string, campi: CampiEstratti): string[] {
  return valutaCaso(caso(id), campi)
    .filter((e) => !e.superato)
    .map((e) => e.controllo)
}

describe('CASI_AVVERSARI_FORMATI', () => {
  it('ogni caso supera tutti i controlli con la risposta ideale', () => {
    for (const c of CASI_AVVERSARI_FORMATI) {
      expect(IDEALI[c.id], `risposta ideale per ${c.id}`).toBeDefined()
      expect(bocciati(c.id, IDEALI[c.id]), c.id).toEqual([])
    }
  })

  it.each(MUTAZIONI)('%s: boccia "%s"', (id, _descrizione, controllo, muta) => {
    expect(bocciati(id, muta(IDEALI[id]))).toContain(controllo)
  })
})
