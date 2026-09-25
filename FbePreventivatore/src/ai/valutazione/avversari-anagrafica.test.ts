import { describe, expect, it } from 'vitest'
import type { CampiEstratti } from '../estrazione'
import { valutaCaso, type CasoValutazione } from '../valutazione-estrazione'
import { CASI_AVVERSARI_ANAGRAFICA } from './avversari-anagrafica'

// Risposte ideali per i casi di avversari-anagrafica.ts: ogni controllo deve superarle tutte,
// come le varianti ammesse. In coda, risposte volutamente sbagliate (una per trappola) che i
// controlli devono bocciare.

const IDEALI: Record<string, CampiEstratti> = {
  'R-anag-1-particelle-sinonimi-negazioni': {
    cliente: { nome: 'De Marchi Anna Maria', comune: 'Bassano del Grappa', provincia: 'VI' },
    protocollo: '2026133',
    progettista: 'geom. Dal Santo Piero',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '88' },
      { piano: 'Piano Primo', valoreLordo: '76' },
      { piano: 'Piano sottotetto', valoreLordo: '32' },
    ],
    tipoCopertura: 'falde',
    finituraEsterna: 'rivestimento',
    pacchetto: 'chiavi in mano',
    spessoreEsterno: '185',
    spessoreInterno: '120',
    spessoreCoibente: '160',
    campiMancanti: [],
  },
  'R-anag-2-piano-non-canonico': {
    cliente: { nome: 'Dal Santo Loris', comune: 'San Pietro in Gu', provincia: 'PD' },
    protocollo: '2026140',
    progettista: 'arch. Lo Presti Carmela',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '102' },
      { piano: 'piano interrato', valoreLordo: '60' },
      { piano: 'Terrazzo', valoreLordo: '18' },
      { piano: 'Garage', valoreLordo: '35' },
    ],
    tipoCopertura: 'piano',
    finituraEsterna: 'intonaco',
    pacchetto: 'grezzo',
    spessoreEsterno: '160',
    spessoreInterno: '100',
    spessoreCoibente: '140',
    spessoreCappotto: '80+40',
    campiMancanti: ['piano interrato'],
  },
  'R-anag-3-alternative-negate': {
    cliente: { nome: 'Dalla Costa Gian Paolo', comune: 'Montecchio Maggiore', provincia: 'VI' },
    superfici: [{ piano: 'Piano Terra', valoreLordo: '140' }],
    tipoCopertura: 'piano',
    finituraEsterna: 'intonaco',
    pacchetto: 'grezzo',
    campiMancanti: ['protocollo', 'progettista', 'spessoreEsterno', 'spessoreInterno', 'spessoreCoibente', 'spessoreCappotto'],
  },
  'R-anag-4-negazione-a-turni': {
    cliente: { nome: 'Da Re Giorgio', comune: 'Castelfranco Veneto', provincia: 'TV' },
    protocollo: '2026151',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '110' },
      { piano: 'Piano Primo', valoreLordo: '95' },
      { piano: 'Portico', valoreLordo: '20' },
      { piano: 'Piano sottotetto', valoreLordo: '45' },
    ],
    tipoCopertura: 'falde',
    finituraEsterna: 'rivestimento',
    pacchetto: 'grezzo avanzato',
    spessoreEsterno: '200',
    spessoreInterno: '140',
    spessoreCoibente: '180',
    campiMancanti: ['progettista'],
  },
}

// Varianti ideali ma scritte diversamente (ordine del nome, maiuscole, accento, "mq",
// formulazione dei mancanti): non devono cambiare l'esito.
const VARIANTI_IDEALI: Record<string, CampiEstratti> = {
  'R-anag-1-particelle-sinonimi-negazioni': {
    ...IDEALI['R-anag-1-particelle-sinonimi-negazioni'],
    cliente: { nome: 'Sig.ra Anna Maria De Marchi', comune: 'BASSANO DEL GRAPPA', provincia: 'vi' },
    progettista: 'Dal Santo Piero',
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '88 mq' },
      { piano: 'Piano Primo', valoreLordo: '76' },
      { piano: 'Piano sottotetto', valoreLordo: '32' },
    ],
    campiMancanti: ['luogo', 'spessoreCappotto'],
  },
  'R-anag-2-piano-non-canonico': {
    ...IDEALI['R-anag-2-piano-non-canonico'],
    cliente: { nome: 'Loris Dal Santo', comune: 'San Pietro in Gù', provincia: 'PD' },
    superfici: [
      { piano: 'Piano Terra', valoreLordo: '102' },
      { piano: 'Piano interrato', valoreLordo: '60 mq' },
      { piano: 'Terrazzo', valoreLordo: '18' },
      { piano: 'Garage', valoreLordo: '35' },
    ],
    campiMancanti: ['superfici: piano "Piano interrato" non riconosciuto'],
  },
  'R-anag-3-alternative-negate': {
    ...IDEALI['R-anag-3-alternative-negate'],
    cliente: { nome: 'Dalla Costa Gianpaolo', comune: 'Montecchio Maggiore', provincia: 'VI' },
    campiMancanti: ['protocollo', 'progettista', 'spessori'],
  },
  'R-anag-4-negazione-a-turni': {
    ...IDEALI['R-anag-4-negazione-a-turni'],
    cliente: { nome: 'Giorgio Da Re', comune: 'Castelfranco Veneto', provincia: 'TV' },
    campiMancanti: ['luogo', 'progettista'],
  },
}

// Letture alternative ammesse delle negazioni e dei dati non decisi: "0" al posto
// dell'omissione, "da decidere" riportato come testo, "luogo" formulato diversamente.
const VARIANTI_NEGAZIONI: Record<string, CampiEstratti> = {
  'R-anag-1-particelle-sinonimi-negazioni': {
    ...IDEALI['R-anag-1-particelle-sinonimi-negazioni'],
    superfici: [...IDEALI['R-anag-1-particelle-sinonimi-negazioni'].superfici, { piano: 'Garage', valoreLordo: '0' }, { piano: 'Portico', valoreLordo: '' }],
    spessoreCappotto: '0',
    campiMancanti: ['luogo (dedotto dal comune)'],
  },
  'R-anag-2-piano-non-canonico': IDEALI['R-anag-2-piano-non-canonico'],
  'R-anag-3-alternative-negate': {
    ...IDEALI['R-anag-3-alternative-negate'],
    superfici: [...IDEALI['R-anag-3-alternative-negate'].superfici, { piano: 'Piano Primo', valoreLordo: '0' }, { piano: 'Garage', valoreLordo: '0' }],
    spessoreEsterno: 'da decidere',
    spessoreInterno: 'da decidere',
  },
  'R-anag-4-negazione-a-turni': {
    ...IDEALI['R-anag-4-negazione-a-turni'],
    superfici: [...IDEALI['R-anag-4-negazione-a-turni'].superfici, { piano: 'Garage', valoreLordo: '0' }],
    spessoreCappotto: 'senza cappotto',
  },
}

// Una trappola per risposta: [caso, descrizione, risposta sbagliata, controllo che deve fallire].
type Sbagliata = [string, string, CampiEstratti, string]
const i1 = IDEALI['R-anag-1-particelle-sinonimi-negazioni']
const i2 = IDEALI['R-anag-2-piano-non-canonico']
const i3 = IDEALI['R-anag-3-alternative-negate']
const i4 = IDEALI['R-anag-4-negazione-a-turni']
const SBAGLIATE: Sbagliata[] = [
  ['R-anag-1-particelle-sinonimi-negazioni', 'particella persa', { ...i1, cliente: { ...i1.cliente, nome: 'Marchi Anna Maria' } }, 'nome cliente con particella e doppio nome, non confuso col progettista'],
  ['R-anag-1-particelle-sinonimi-negazioni', 'secondo nome perso', { ...i1, cliente: { ...i1.cliente, nome: 'De Marchi Anna' } }, 'nome cliente con particella e doppio nome, non confuso col progettista'],
  ['R-anag-1-particelle-sinonimi-negazioni', 'comune troncato', { ...i1, cliente: { ...i1.cliente, comune: 'Bassano' } }, 'comune di tre parole senza (VI), provincia VI'],
  ['R-anag-1-particelle-sinonimi-negazioni', 'provincia nel comune', { ...i1, cliente: { ...i1.cliente, comune: 'Bassano del Grappa (VI)' } }, 'comune di tre parole senza (VI), provincia VI'],
  ['R-anag-1-particelle-sinonimi-negazioni', 'pianterreno non normalizzato', { ...i1, superfici: [{ piano: 'pianterreno', valoreLordo: '88' }, ...i1.superfici.slice(1)] }, 'pianterreno/1° piano/sottotetto -> nomi canonici'],
  ['R-anag-1-particelle-sinonimi-negazioni', 'garage inventato', { ...i1, superfici: [...i1.superfici, { piano: 'Garage', valoreLordo: '30' }] }, 'niente garage / non c è portico: nessuna superficie valorizzata per loro'],
  ['R-anag-1-particelle-sinonimi-negazioni', 'cappotto inventato', { ...i1, spessoreCappotto: '120' }, 'senza cappotto: nessuno spessore di cappotto'],
  ['R-anag-2-piano-non-canonico', 'interrato fuso nel piano terra', { ...i2, superfici: i2.superfici.filter((s) => s.piano !== 'piano interrato') }, 'piano interrato riportato com è, non ricondotto a un canonico'],
  ['R-anag-2-piano-non-canonico', 'interrato non segnalato', { ...i2, campiMancanti: [] }, 'piano interrato segnalato in campiMancanti'],
  ['R-anag-2-piano-non-canonico', 'interrato spacciato per Garage', { ...i2, superfici: i2.superfici.map((s) => (s.piano === 'piano interrato' ? { ...s, piano: 'Garage' } : s)) }, 'piano interrato riportato com è, non ricondotto a un canonico'],
  ['R-anag-2-piano-non-canonico', 'segnala un campo presente', { ...i2, campiMancanti: ['piano interrato', 'provincia'] }, 'nessun campo presente segnalato mancante'],
  ['R-anag-2-piano-non-canonico', 'progettista preso come cliente', { ...i2, cliente: { ...i2.cliente, nome: 'Lo Presti Carmela' } }, 'nome cliente con particella, non confuso col progettista'],
  ['R-anag-3-alternative-negate', 'sigla lasciata nel comune', { ...i3, cliente: { ...i3.cliente, comune: 'Montecchio Maggiore VI', provincia: undefined } }, 'comune "Montecchio Maggiore VI": sigla separata dal comune'],
  ['R-anag-3-alternative-negate', 'negazione ignorata: falde', { ...i3, tipoCopertura: 'falde' }, 'copertura "non a falde: tetto piano" -> piano'],
  ['R-anag-3-alternative-negate', 'negazione ignorata: chiavi in mano', { ...i3, pacchetto: 'chiavi in mano' }, 'alternative negate: intonaco (non rivestimento), grezzo (non chiavi in mano)'],
  ['R-anag-3-alternative-negate', 'primo piano negato valorizzato', { ...i3, superfici: [...i3.superfici, { piano: 'Piano Primo', valoreLordo: '80' }] }, 'niente primo piano / no garage: nessuna altra superficie valorizzata'],
  ['R-anag-3-alternative-negate', 'spessore inventato', { ...i3, spessoreEsterno: '200' }, 'spessori da decidere: nessuna misura inventata'],
  ['R-anag-4-negazione-a-turni', 'garage del primo turno rimasto', { ...i4, superfici: [...i4.superfici, { piano: 'Garage', valoreLordo: '38' }] }, 'garage tolto al secondo turno: nessuna superficie garage valorizzata'],
  ['R-anag-4-negazione-a-turni', 'cappotto del primo turno rimasto', { ...i4, spessoreCappotto: '100' }, 'cappotto tolto al secondo turno: nessuno spessore di cappotto'],
  ['R-anag-4-negazione-a-turni', 'sottotetto del terzo turno perso', { ...i4, superfici: i4.superfici.filter((s) => s.piano !== 'Piano sottotetto') }, 'sottotetto aggiunto al terzo turno: Piano sottotetto 45'],
  ['R-anag-4-negazione-a-turni', 'portico perso', { ...i4, superfici: i4.superfici.filter((s) => s.piano !== 'Portico') }, 'piani non toccati dalle correzioni restano: PT 110, 1° piano 95, portico 20'],
  ['R-anag-4-negazione-a-turni', 'particella "Da" persa', { ...i4, cliente: { ...i4.cliente, nome: 'Re Giorgio' } }, 'nome cliente con particella corta "Da Re"'],
  ['R-anag-4-negazione-a-turni', 'progettista inventato', { ...i4, progettista: 'arch. Rossi', campiMancanti: [] }, 'progettista mai detto: non inventato e segnalato'],
]

function caso(id: string): CasoValutazione {
  const trovato = CASI_AVVERSARI_ANAGRAFICA.find((c) => c.id === id)
  if (!trovato) throw new Error(`caso ${id} assente`)
  return trovato
}

function bocciati(id: string, campi: CampiEstratti): string[] {
  return valutaCaso(caso(id), campi)
    .filter((e) => !e.superato)
    .map((e) => e.controllo)
}

describe('CASI_AVVERSARI_ANAGRAFICA', () => {
  it.each([
    ['ideale', IDEALI],
    ['variante di forma', VARIANTI_IDEALI],
    ['lettura alternativa delle negazioni', VARIANTI_NEGAZIONI],
  ] as const)('ogni caso supera tutti i controlli con la risposta %s', (_etichetta, risposte) => {
    for (const c of CASI_AVVERSARI_ANAGRAFICA) {
      expect(risposte[c.id], `risposta per ${c.id}`).toBeDefined()
      expect(bocciati(c.id, risposte[c.id]), c.id).toEqual([])
    }
  })

  it.each(SBAGLIATE)('%s: boccia "%s"', (id, _descrizione, campi, controllo) => {
    expect(bocciati(id, campi)).toContain(controllo)
  })
})
