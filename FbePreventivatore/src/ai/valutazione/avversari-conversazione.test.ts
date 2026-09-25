import { describe, expect, it } from 'vitest'
import type { CampiEstratti } from '../estrazione'
import { valutaCaso, type CasoValutazione } from '../valutazione-estrazione'
import { CASI_AVVERSARI_CONVERSAZIONE } from './avversari-conversazione'

// Risposte ideali per avversari-conversazione.ts: una per caso, come la darebbe un estrattore
// che segue alla lettera PROMPT_SISTEMA e le convenzioni fissate. Ogni controllo deve
// superarle tutte: un controllo che boccia la risposta ideale è sbagliato.
const IDEALI: Record<string, CampiEstratti> = {
  'R-conv-correzioni-a-catena': {
    cliente: { nome: 'Tonello Silvia', comune: 'Brendola', provincia: 'VI' },
    protocollo: '2026134',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '118' },
      { piano: 'Piano Primo', valoreLordo: '96' },
      { piano: 'Portico', valoreLordo: '18' },
    ],
    tipoCopertura: 'falde',
    finituraEsterna: 'rivestimento',
    pacchetto: 'grezzo avanzato',
    campiMancanti: ['progettista', 'spessoreEsterno', 'spessoreInterno', 'spessoreCoibente', 'spessoreCappotto'],
  },
  'R-conv-distrattori-numerici': {
    cliente: { nome: 'Marchetto Denis', comune: 'Montecchio Maggiore', provincia: 'VI' },
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '142' },
      { piano: 'Garage', valoreLordo: '36' },
    ],
    tipoCopertura: 'piano',
    spessoreCappotto: '120',
    campiMancanti: [
      'protocollo',
      'progettista',
      'finituraEsterna',
      'pacchetto',
      'spessoreEsterno',
      'spessoreInterno',
      'spessoreCoibente',
    ],
  },
  'R-conv-dati-ritirati': {
    cliente: { nome: 'Pegoraro Chiara', comune: 'Arcugnano', provincia: 'VI' },
    protocollo: '2026147',
    progettista: 'arch. Ilaria Sartori',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '98' },
      { piano: 'Piano Primo', valoreLordo: '84' },
      { piano: 'Terrazzo', valoreLordo: '12' },
    ],
    tipoCopertura: 'falde',
    finituraEsterna: 'intonaco',
    campiMancanti: ['pacchetto', 'spessoreEsterno', 'spessoreInterno', 'spessoreCoibente', 'spessoreCappotto'],
  },
  'R-conv-serramenti-spessori-a-turni': {
    cliente: { nome: 'Dal Maso Ivano', comune: 'Marostica', provincia: 'VI' },
    protocollo: '2026158',
    superfici: [],
    tipoCopertura: 'falde',
    finituraEsterna: 'rivestimento',
    pacchetto: 'grezzo',
    spessoreEsterno: '225',
    spessoreInterno: '145',
    spessoreCoibente: '100+60',
    serramenti: [
      { n: 1, piano: 'Piano Terra', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.1, h: 2.3 },
      { n: 2, piano: 'Piano Terra', tipologia: 'alzante scorrevole', categoria: 'alzante-scorrevole', b: 1.6, h: 2.4 },
    ],
    campiMancanti: ['progettista', 'superfici', 'spessoreCappotto'],
  },
}

// Varianti di forma che i controlli dichiarano di tollerare (unità "mq"/"mm" in coda, spazi,
// maiuscole del nome piano, garage ritirato scritto "0"): non devono cambiare l'esito.
const VARIANTI_AMMESSE: Record<string, CampiEstratti> = {
  'R-conv-correzioni-a-catena': {
    ...IDEALI['R-conv-correzioni-a-catena'],
    cliente: { nome: 'Tonello Silvia', comune: ' Brendola', provincia: 'VI ' },
    superfici: [
      { piano: 'piano terra', valoreLordo: '118 mq' },
      { piano: 'Piano Primo', valoreLordo: '96' },
      { piano: 'portico', valoreLordo: '18 mq' },
    ],
  },
  'R-conv-distrattori-numerici': {
    ...IDEALI['R-conv-distrattori-numerici'],
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '142 m2' },
      { piano: 'garage', valoreLordo: '36 mq' },
    ],
    spessoreCappotto: '120 mm',
  },
  'R-conv-dati-ritirati': {
    ...IDEALI['R-conv-dati-ritirati'],
    superfici: [...IDEALI['R-conv-dati-ritirati'].superfici, { piano: 'Garage', valoreLordo: '0' }],
  },
  'R-conv-serramenti-spessori-a-turni': {
    ...IDEALI['R-conv-serramenti-spessori-a-turni'],
    spessoreEsterno: '225 mm',
    spessoreInterno: '145mm',
    spessoreCoibente: '100 + 60 mm',
  },
}

// Varianti sbagliate, una per trappola: [caso, descrizione, controllo che DEVE bocciarla,
// trasformazione]. Scritte qui (il file di origine dei casi aveva solo le ideali) con la stessa
// forma delle mutazioni di avversari-formati.test.ts.
type Mutazione = [string, string, string, (c: CampiEstratti) => CampiEstratti]
const copia = (c: CampiEstratti): CampiEstratti => structuredClone(c)

const MUTAZIONI: Mutazione[] = [
  ['R-conv-correzioni-a-catena', 'comune della prima menzione', 'comune corretto al secondo turno: Brendola (VI), non Lonigo',
    (c) => { const x = copia(c); x.cliente.comune = 'Lonigo'; return x }],
  ['R-conv-correzioni-a-catena', 'piano terra vecchio tenuto', 'piano terra: vale la correzione 118, in una sola riga',
    (c) => { const x = copia(c); x.superfici[0].valoreLordo = '112'; return x }],
  ['R-conv-correzioni-a-catena', 'piano terra duplicato (vecchio e nuovo)', 'piano terra: vale la correzione 118, in una sola riga',
    (c) => { const x = copia(c); x.superfici.push({ piano: 'Piano Terra', valoreLordo: '112' }); return x }],
  ['R-conv-correzioni-a-catena', 'portico perso con la correzione', 'superfici non corrette restano: Piano Primo 96, Portico 18, niente altro',
    (c) => { const x = copia(c); x.superfici = x.superfici.filter((s) => s.piano !== 'Portico'); return x }],
  ['R-conv-correzioni-a-catena', 'finitura del primo turno tenuta', 'finitura cambiata in rivestimento',
    (c) => { const x = copia(c); x.finituraEsterna = 'intonaco'; return x }],
  ['R-conv-correzioni-a-catena', 'pacchetto cancellato dalle correzioni', 'copertura e pacchetto del primo turno non toccati dalle correzioni',
    (c) => { const x = copia(c); delete x.pacchetto; return x }],
  ['R-conv-correzioni-a-catena', 'data presa come protocollo', 'protocollo dall ultimo turno, non la data 3/10',
    (c) => { const x = copia(c); x.protocollo = '3/10'; return x }],
  ['R-conv-correzioni-a-catena', 'spessore inventato', 'spessori mai citati: non inventati',
    (c) => { const x = copia(c); x.spessoreEsterno = '205'; return x }],
  ['R-conv-distrattori-numerici', 'indirizzo nel nome', 'nome cliente senza indirizzo, telefono o mail',
    (c) => { const x = copia(c); x.cliente.nome = 'Marchetto Denis, via Roma 14'; return x }],
  ['R-conv-distrattori-numerici', 'CAP nel comune', 'comune dall indirizzo, non CAP né via',
    (c) => { const x = copia(c); x.cliente.comune = '36075 Montecchio Maggiore'; return x }],
  ['R-conv-distrattori-numerici', 'pratica edilizia presa come protocollo', 'protocollo da assegnare: assente (non pratica edilizia, catasto, telefono) e segnalato',
    (c) => { const x = copia(c); x.protocollo = '2026/0457'; return x }],
  ['R-conv-distrattori-numerici', 'protocollo da assegnare non segnalato', 'protocollo da assegnare: assente (non pratica edilizia, catasto, telefono) e segnalato',
    (c) => { const x = copia(c); x.campiMancanti = x.campiMancanti.filter((k) => k !== 'protocollo'); return x }],
  ['R-conv-distrattori-numerici', 'garage perso', 'superfici dei piani: Piano Terra 142 e Garage 36',
    (c) => { const x = copia(c); x.superfici = x.superfici.filter((s) => s.piano !== 'Garage'); return x }],
  ['R-conv-distrattori-numerici', 'lotto preso come superficie', 'il lotto di 900 mq non è una superficie di piano',
    (c) => { const x = copia(c); x.superfici.push({ piano: 'Lotto', valoreLordo: '900' }); return x }],
  ['R-conv-distrattori-numerici', 'spessore esterno inventato', 'cappotto 120, gli altri spessori non inventati',
    (c) => { const x = copia(c); x.spessoreEsterno = '200'; return x }],
  ['R-conv-distrattori-numerici', 'progettista senza nome valorizzato', 'progettista citato senza nome: non inventato',
    (c) => { const x = copia(c); x.progettista = 'il progettista'; return x }],
  ['R-conv-dati-ritirati', 'garage ritirato rimasto', 'garage ritirato: nessuna superficie garage',
    (c) => { const x = copia(c); x.superfici.push({ piano: 'Garage', valoreLordo: '30' }); return x }],
  ['R-conv-dati-ritirati', 'terrazzo perso insieme al garage', 'piani non ritirati restano: Piano Terra 98, Piano Primo 84, Terrazzo 12',
    (c) => { const x = copia(c); x.superfici = x.superfici.filter((s) => s.piano !== 'Terrazzo'); return x }],
  ['R-conv-dati-ritirati', 'pacchetto ritirato rimasto', 'pacchetto ritirato: non più valorizzato',
    (c) => { const x = copia(c); x.pacchetto = 'chiavi in mano'; return x }],
  ['R-conv-dati-ritirati', 'pacchetto ritirato non segnalato', 'pacchetto ritirato: segnalato mancante',
    (c) => { const x = copia(c); x.campiMancanti = x.campiMancanti.filter((k) => k !== 'pacchetto'); return x }],
  ['R-conv-dati-ritirati', 'copertura di prima dell "anzi"', 'copertura: vale l "anzi" -> falde',
    (c) => { const x = copia(c); x.tipoCopertura = 'piano'; return x }],
  ['R-conv-dati-ritirati', 'progettista vecchio tenuto', 'progettista: vale l ultima menzione (Sartori, non Fabris)',
    (c) => { const x = copia(c); x.progettista = 'geom. Luca Fabris'; return x }],
  ['R-conv-dati-ritirati', 'progettisti vecchio e nuovo insieme', 'progettista: vale l ultima menzione (Sartori, non Fabris)',
    (c) => { const x = copia(c); x.progettista = 'arch. Ilaria Sartori (prima geom. Luca Fabris)'; return x }],
  ['R-conv-dati-ritirati', 'protocollo abbreviato non riconosciuto', 'protocollo abbreviato "prot." riconosciuto',
    (c) => { const x = copia(c); delete x.protocollo; return x }],
  ['R-conv-serramenti-spessori-a-turni', 'spessore esterno vecchio tenuto', 'spessore esterno: vale la correzione 225',
    (c) => { const x = copia(c); x.spessoreEsterno = '185'; return x }],
  ['R-conv-serramenti-spessori-a-turni', 'coibente composito sommato', 'coibente corretto nel composito 100+60',
    (c) => { const x = copia(c); x.spessoreCoibente = '160'; return x }],
  ['R-conv-serramenti-spessori-a-turni', 'cappotto inventato', 'interno non corretto resta 145, cappotto mai citato non inventato',
    (c) => { const x = copia(c); x.spessoreCappotto = '140'; return x }],
  ['R-conv-serramenti-spessori-a-turni', 'portoncino perso con le correzioni', 'portoncino 1,1 x 2,3 non toccato dalle correzioni',
    (c) => { const x = copia(c); x.serramenti = x.serramenti!.filter((s) => s.categoria !== 'portoncino'); return x }],
  ['R-conv-serramenti-spessori-a-turni', 'portafinestra rimasta battente', 'portafinestra diventata alzante scorrevole 1,6 x 2,4',
    (c) => {
      const x = copia(c)
      x.serramenti = x.serramenti!.map((s) => (s.categoria === 'alzante-scorrevole' ? { ...s, tipologia: 'portafinestra', categoria: 'portafinestra-battente' } : s))
      return x
    }],
  ['R-conv-serramenti-spessori-a-turni', 'alzante aggiunto accanto alla portafinestra', 'portafinestra diventata alzante scorrevole 1,6 x 2,4',
    (c) => { const x = copia(c); x.serramenti!.push({ n: 3, piano: 'Piano Terra', tipologia: 'portafinestra', categoria: 'portafinestra-battente', b: 1.6, h: 2.4 }); return x }],
  ['R-conv-serramenti-spessori-a-turni', 'finestra ritirata rimasta', 'finestra del piano primo ritirata',
    (c) => { const x = copia(c); x.serramenti!.push({ n: 3, piano: 'Piano Primo', tipologia: 'finestra', categoria: 'finestra-battente', b: 1, h: 1.3 }); return x }],
  ['R-conv-serramenti-spessori-a-turni', 'telefono preso come protocollo', 'protocollo non sovrascritto dal telefono',
    (c) => { const x = copia(c); x.protocollo = '0424 882170'; return x }],
]

function caso(id: string): CasoValutazione {
  const trovato = CASI_AVVERSARI_CONVERSAZIONE.find((c) => c.id === id)
  if (!trovato) throw new Error(`caso ${id} assente`)
  return trovato
}

function bocciati(id: string, campi: CampiEstratti): string[] {
  return valutaCaso(caso(id), campi)
    .filter((e) => !e.superato)
    .map((e) => e.controllo)
}

describe('CASI_AVVERSARI_CONVERSAZIONE', () => {
  it.each([
    ['ideale', IDEALI],
    ['con varianti di forma ammesse', VARIANTI_AMMESSE],
  ] as const)('ogni caso supera tutti i controlli con la risposta %s', (_etichetta, risposte) => {
    for (const c of CASI_AVVERSARI_CONVERSAZIONE) {
      expect(risposte[c.id], `risposta per ${c.id}`).toBeDefined()
      expect(bocciati(c.id, risposte[c.id]), c.id).toEqual([])
    }
  })

  it.each(MUTAZIONI)('%s: boccia "%s"', (id, _descrizione, controllo, muta) => {
    expect(bocciati(id, muta(IDEALI[id]))).toContain(controllo)
  })
})
