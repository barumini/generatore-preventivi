import { describe, expect, it } from 'vitest'
import type { CampiEstratti } from '../estrazione'
import { valutaCaso, type CasoValutazione } from '../valutazione-estrazione'
import { CASI_CONTROLLO } from './controllo'

// Risposte ideali per i casi di controllo, nella forma che dà il sistema in produzione:
// campiMancanti calcolati in codice con gli id dei campi rimasti vuoti (mai "luogo"),
// serramenti e pareti numerati da 1, superfici nella forma scritta senza unità.
// Ogni controllo deve superarle; le mutazioni in coda, una per trappola, devono essere
// bocciate dal controllo mirato.

const SPESSORI = ['spessoreEsterno', 'spessoreInterno', 'spessoreCoibente', 'spessoreCappotto']

// Anagrafica e fabbricato del testo Crivellaro completo, comune a N1 e N4.
const CRIVELLARO: CampiEstratti = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  progettista: 'arch. Paolo Bianchi',
  luogo: 'Trissino',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  tipoCopertura: 'falde',
  finituraEsterna: 'intonaco',
  pacchetto: 'grezzo avanzato',
  spessoreEsterno: '205',
  spessoreInterno: '160',
  spessoreCoibente: '200',
  spessoreCappotto: '140',
  campiMancanti: [],
}

const IDEALI: Record<string, CampiEstratti> = {
  'N1-pareti-falda': {
    ...CRIVELLARO,
    pareti: [{ n: 1, tipo: 'E', b: 12.5, h: 2.7, spessore: 20 }],
    falde: [{ etichetta: 'falda', notazione: '5,8x16,5 x17,1' }],
  },
  'N2-multi-turno': {
    cliente: { nome: 'Bortolan Giulia', comune: 'Schio', provincia: 'VI' },
    protocollo: '2026071',
    superfici: [],
    tipoCopertura: 'piano',
    pacchetto: 'chiavi in mano',
    campiMancanti: ['progettista', 'finituraEsterna', ...SPESSORI, 'superfici'],
  },
  'N3-piani-da-normalizzare': {
    cliente: { nome: 'Zanella Marco', comune: 'Thiene', provincia: 'VI' },
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '120' },
      { piano: 'Piano Primo', valoreLordo: '80' },
      { piano: 'Piano sottotetto', valoreLordo: '40' },
      { piano: 'Garage', valoreLordo: '30' },
    ],
    finituraEsterna: 'rivestimento',
    campiMancanti: ['protocollo', 'progettista', 'tipoCopertura', 'pacchetto', ...SPESSORI],
  },
  'N4-serramenti-misti': {
    ...CRIVELLARO,
    serramenti: [
      { n: 1, piano: 'Piano Primo', tipologia: 'finestra', categoria: 'finestra-battente', b: 1.2, h: 1.4 },
      { n: 2, piano: 'Piano Primo', tipologia: 'portafinestra', categoria: 'portafinestra-battente', b: 0.9, h: 2.4 },
    ],
  },
  'N5-minimo': {
    cliente: { nome: 'Rossi Giovanni' },
    superfici: [],
    campiMancanti: [
      'cliente.comune',
      'cliente.provincia',
      'protocollo',
      'progettista',
      'tipoCopertura',
      'finituraEsterna',
      'pacchetto',
      ...SPESSORI,
      'superfici',
    ],
  },
}

// Varianti di forma che i controlli tollerano ("luogo" tra i mancanti, "mq" in coda,
// campi mancanti scritti per esteso): non devono cambiare l'esito.
const VARIANTI_AMMESSE: Record<string, CampiEstratti> = {
  'N1-pareti-falda': { ...IDEALI['N1-pareti-falda'], campiMancanti: ['luogo'] },
  'N2-multi-turno': { ...IDEALI['N2-multi-turno'], campiMancanti: ['progettista', 'finitura esterna', 'spessori', 'superfici'] },
  'N3-piani-da-normalizzare': {
    ...IDEALI['N3-piani-da-normalizzare'],
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '120 mq' },
      { piano: 'Piano Primo', valoreLordo: '80 mq' },
      { piano: 'Piano sottotetto', valoreLordo: '40' },
      { piano: 'Garage', valoreLordo: '30 MQ' },
    ],
    campiMancanti: ['Protocollo', 'tipo di copertura'],
  },
  'N4-serramenti-misti': { ...IDEALI['N4-serramenti-misti'], campiMancanti: ['luogo'] },
  'N5-minimo': { ...IDEALI['N5-minimo'], campiMancanti: ['protocollo', 'superfici'] },
}

// Varianti sbagliate: [caso, descrizione, controllo che DEVE bocciarla, trasformazione].
type Mutazione = [string, string, string, (c: CampiEstratti) => CampiEstratti]
const copia = (c: CampiEstratti): CampiEstratti => structuredClone(c)

const MUTAZIONI: Mutazione[] = [
  ['N1-pareti-falda', 'spessore parete preso dallo spessore esterno', 'una parete E 12.5x2.7 sp 20',
    (c) => { const x = copia(c); x.pareti![0].spessore = 205; return x }],
  ['N1-pareti-falda', 'parete esterna letta come interna', 'una parete E 12.5x2.7 sp 20',
    (c) => { const x = copia(c); x.pareti![0].tipo = 'I'; return x }],
  ['N1-pareti-falda', 'falda calcolata invece che trascritta', 'falda con notazione testuale',
    (c) => { const x = copia(c); x.falde![0].notazione = '95,70'; return x }],
  ['N1-pareti-falda', 'trave inventata dalla falda', 'nessun serramento/trave inventato',
    (c) => { const x = copia(c); x.travi = [{ etichetta: 'trave', notazione: '5,8x16,5' }]; return x }],
  ['N1-pareti-falda', 'spessore esterno sovrascritto da quello della parete', 'spessori ancora corretti',
    (c) => { const x = copia(c); x.spessoreEsterno = '20'; return x }],
  ['N1-pareti-falda', 'campo presente segnalato mancante', 'nessun mancante',
    (c) => { const x = copia(c); x.campiMancanti = ['protocollo']; return x }],
  ['N2-multi-turno', 'comune sbagliato', 'nome e comune',
    (c) => { const x = copia(c); x.cliente.comune = 'Vicenza'; return x }],
  ['N2-multi-turno', 'prima menzione tenuta: grezzo', 'ultima menzione vince: chiavi in mano',
    (c) => { const x = copia(c); x.pacchetto = 'grezzo'; return x }],
  ['N2-multi-turno', 'protocollo del secondo turno perso', 'protocollo dal secondo turno',
    (c) => { const x = copia(c); delete x.protocollo; return x }],
  ['N2-multi-turno', 'copertura persa', 'copertura piano',
    (c) => { const x = copia(c); delete x.tipoCopertura; return x }],
  ['N2-multi-turno', 'finitura inventata', 'finitura non inventata',
    (c) => { const x = copia(c); x.finituraEsterna = 'intonaco'; return x }],
  ['N2-multi-turno', 'spessore inventato', 'spessori non inventati',
    (c) => { const x = copia(c); x.spessoreCappotto = '140'; return x }],
  ['N2-multi-turno', 'superficie inventata', 'superfici non inventate',
    (c) => { const x = copia(c); x.superfici = [{ piano: 'Piano Terra', valoreLordo: '134' }]; return x }],
  ['N2-multi-turno', 'finitura non segnalata', 'finitura segnalata mancante',
    (c) => { const x = copia(c); x.campiMancanti = x.campiMancanti.filter((k) => k !== 'finituraEsterna'); return x }],
  ['N3-piani-da-normalizzare', 'sigla PT lasciata com è', 'piani canonici',
    (c) => { const x = copia(c); x.superfici[0].piano = 'PT'; return x }],
  ['N3-piani-da-normalizzare', 'mansarda non ricondotta al sottotetto', 'piani canonici',
    (c) => { const x = copia(c); x.superfici[2].piano = 'mansarda'; return x }],
  ['N3-piani-da-normalizzare', 'box auto non ricondotto al garage', 'piani canonici',
    (c) => { const x = copia(c); x.superfici[3].piano = 'box auto'; return x }],
  ['N3-piani-da-normalizzare', 'piano mai detto aggiunto', 'piani canonici',
    (c) => { const x = copia(c); x.superfici.push({ piano: 'Portico', valoreLordo: '0' }); return x }],
  ['N3-piani-da-normalizzare', 'finitura sbagliata', 'finitura rivestimento',
    (c) => { const x = copia(c); x.finituraEsterna = 'intonaco'; return x }],
  ['N3-piani-da-normalizzare', 'protocollo inventato', 'protocollo non inventato e segnalato',
    (c) => { const x = copia(c); x.protocollo = '2026059'; return x }],
  ['N3-piani-da-normalizzare', 'protocollo non segnalato', 'protocollo non inventato e segnalato',
    (c) => { const x = copia(c); x.campiMancanti = x.campiMancanti.filter((k) => k !== 'protocollo'); return x }],
  ['N3-piani-da-normalizzare', 'copertura inventata', 'copertura e pacchetto non inventati',
    (c) => { const x = copia(c); x.tipoCopertura = 'falde'; return x }],
  ['N3-piani-da-normalizzare', 'pacchetto inventato', 'copertura e pacchetto non inventati',
    (c) => { const x = copia(c); x.pacchetto = 'grezzo'; return x }],
  ['N3-piani-da-normalizzare', 'copertura non segnalata', 'copertura segnalata mancante',
    (c) => { const x = copia(c); x.campiMancanti = x.campiMancanti.filter((k) => k !== 'tipoCopertura'); return x }],
  ['N4-serramenti-misti', 'finestra lasciata in cm', 'finestra 1.2x1.4',
    (c) => { const x = copia(c); x.serramenti![0] = { ...x.serramenti![0], b: 120, h: 140 }; return x }],
  ['N4-serramenti-misti', 'portafinestra classificata come finestra', 'portafinestra 0.9x2.4',
    (c) => { const x = copia(c); x.serramenti![1].categoria = 'finestra-battente'; return x }],
  ['N4-serramenti-misti', 'alzante con altezza inventata', 'alzante senza altezza omesso',
    (c) => { const x = copia(c); x.serramenti!.push({ n: 3, piano: 'Piano Terra', tipologia: 'alzante scorrevole', categoria: 'alzante-scorrevole', b: 3, h: 2.4 }); return x }],
  ['N4-serramenti-misti', 'serramento duplicato', 'due serramenti',
    (c) => { const x = copia(c); x.serramenti!.push({ ...x.serramenti![0], n: 3 }); return x }],
  ['N5-minimo', 'prefisso rimasto nel nome', 'nome',
    (c) => { const x = copia(c); x.cliente.nome = 'Casa per Rossi Giovanni'; return x }],
  ['N5-minimo', 'comune inventato', 'comune/provincia non inventati',
    (c) => { const x = copia(c); x.cliente.comune = 'Vicenza'; return x }],
  ['N5-minimo', 'provincia inventata', 'comune/provincia non inventati',
    (c) => { const x = copia(c); x.cliente.provincia = 'VI'; return x }],
  ['N5-minimo', 'protocollo inventato', 'nulla inventato',
    (c) => { const x = copia(c); x.protocollo = '2026059'; return x }],
  ['N5-minimo', 'pacchetto di default', 'nulla inventato',
    (c) => { const x = copia(c); x.pacchetto = 'grezzo'; return x }],
  ['N5-minimo', 'superfici non segnalate', 'protocollo e superfici segnalati',
    (c) => { const x = copia(c); x.campiMancanti = x.campiMancanti.filter((k) => k !== 'superfici'); return x }],
]

function caso(id: string): CasoValutazione {
  const trovato = CASI_CONTROLLO.find((c) => c.id === id)
  if (!trovato) throw new Error(`caso ${id} assente`)
  return trovato
}

function bocciati(id: string, campi: CampiEstratti): string[] {
  return valutaCaso(caso(id), campi)
    .filter((e) => !e.superato)
    .map((e) => e.controllo)
}

describe('CASI_CONTROLLO', () => {
  it('sono i 5 casi di controllo, con gli id con cui sono stati misurati', () => {
    expect(CASI_CONTROLLO.map((c) => c.id)).toEqual([
      'N1-pareti-falda',
      'N2-multi-turno',
      'N3-piani-da-normalizzare',
      'N4-serramenti-misti',
      'N5-minimo',
    ])
  })

  it.each([
    ['ideale', IDEALI],
    ['con varianti di forma ammesse', VARIANTI_AMMESSE],
  ] as const)('ogni caso supera tutti i controlli con la risposta %s', (_etichetta, risposte) => {
    for (const c of CASI_CONTROLLO) {
      expect(risposte[c.id], `risposta per ${c.id}`).toBeDefined()
      expect(bocciati(c.id, risposte[c.id]), c.id).toEqual([])
    }
  })

  it.each(MUTAZIONI)('%s: boccia "%s"', (id, _descrizione, controllo, muta) => {
    expect(bocciati(id, muta(IDEALI[id]))).toContain(controllo)
  })
})
