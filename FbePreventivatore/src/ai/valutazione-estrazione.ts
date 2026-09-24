import type { CampiEstratti } from './estrazione'

// Casi e controlli per confrontare modelli e configurazioni dell'estrazione su dati reali
// (golden case Crivellaro, docs/testing-golden-case-crivellaro.md §3.1). Sono puri: lo
// script scripts/valuta-estrazione.ts li esegue contro un modello vero, i test li
// verificano contro risposte finte.

export interface Controllo {
  nome: string
  verifica: (campi: CampiEstratti) => boolean
}

export interface CasoValutazione {
  id: string
  testo: string
  controlli: Controllo[]
}

const ANAGRAFICA = 'Preventivo per il cliente Crivellaro Mariano, comune di Trissino, provincia VI.'
const PROTOCOLLO = 'Protocollo 2026059.'
const PROGETTISTA = 'Progettista: arch. Paolo Bianchi. Luogo del cantiere: Trissino.'
const RESTO = `Superfici: Piano Terra 134 mq, Portico 13+14 mq, Garage 41 mq.
Copertura a falde, finitura esterna a intonaco. Pacchetto grezzo avanzato.
Spessori: esterno 205 mm, interno 160 mm, coibente 200 mm, cappotto 140 mm.`

const TESTO_COMPLETO = `${ANAGRAFICA}\n${PROTOCOLLO} ${PROGETTISTA}\n${RESTO}`
const TESTO_SENZA_PROTOCOLLO = `${ANAGRAFICA}\n${PROGETTISTA}\n${RESTO}`
const TESTO_FINESTRA_SENZA_ALTEZZA = `${TESTO_COMPLETO}
Al piano terra c'è una porta di ingresso di base 1 m e altezza 2,2 m, e una finestra al piano terra, base 2 m.`

const SUPERFICI_ATTESE = [
  { piano: 'Piano Terra', valoreLordo: '134' },
  { piano: 'Portico', valoreLordo: '13+14' },
  { piano: 'Garage', valoreLordo: '41' },
]

// "luogo" non conta: il prompt chiede di non segnalarlo e la chat lo scarta comunque
// (si deduce dal comune, vedi ChatApertura.tsx).
function mancantiVisibili(campi: CampiEstratti): string[] {
  return campi.campiMancanti.filter((campo) => campo !== 'luogo')
}

function superficiUguali(campi: CampiEstratti): boolean {
  const chiave = (s: { piano: string; valoreLordo: string }) => `${s.piano}=${s.valoreLordo.replace(/\s/g, '')}`
  const ottenute = campi.superfici.map(chiave).sort()
  const attese = SUPERFICI_ATTESE.map(chiave).sort()
  return ottenute.length === attese.length && ottenute.every((s, i) => s === attese[i])
}

const controlliAnagrafica: Controllo[] = [
  { nome: 'cliente nome', verifica: (c) => c.cliente.nome === 'Crivellaro Mariano' },
  { nome: 'cliente comune e provincia', verifica: (c) => c.cliente.comune === 'Trissino' && c.cliente.provincia === 'VI' },
  { nome: 'progettista', verifica: (c) => (c.progettista ?? '').includes('Paolo Bianchi') },
]

const controlliFabbricato: Controllo[] = [
  { nome: 'superfici canoniche, forma scritta conservata', verifica: superficiUguali },
  {
    nome: 'copertura, finitura, pacchetto',
    verifica: (c) => c.tipoCopertura === 'falde' && c.finituraEsterna === 'intonaco' && c.pacchetto === 'grezzo avanzato',
  },
  {
    nome: 'spessori come scritti',
    verifica: (c) =>
      c.spessoreEsterno === '205' &&
      c.spessoreInterno === '160' &&
      c.spessoreCoibente === '200' &&
      c.spessoreCappotto === '140',
  },
]

const nessunElementoInventato: Controllo = {
  nome: 'nessun serramento/parete/falda/trave inventato',
  verifica: (c) => !c.serramenti?.length && !c.pareti?.length && !c.falde?.length && !c.travi?.length,
}

export const CASI_VALUTAZIONE: CasoValutazione[] = [
  {
    id: 'completo',
    testo: TESTO_COMPLETO,
    controlli: [
      ...controlliAnagrafica,
      { nome: 'protocollo', verifica: (c) => c.protocollo === '2026059' },
      ...controlliFabbricato,
      nessunElementoInventato,
      { nome: 'nessun campo mancante segnalato', verifica: (c) => mancantiVisibili(c).length === 0 },
    ],
  },
  {
    id: 'senza-protocollo',
    testo: TESTO_SENZA_PROTOCOLLO,
    controlli: [
      ...controlliAnagrafica,
      { nome: 'protocollo non inventato', verifica: (c) => !c.protocollo },
      { nome: 'protocollo segnalato mancante', verifica: (c) => mancantiVisibili(c).includes('protocollo') },
      { nome: 'solo protocollo segnalato', verifica: (c) => mancantiVisibili(c).every((campo) => campo === 'protocollo') },
      ...controlliFabbricato,
    ],
  },
  {
    id: 'finestra-senza-altezza',
    testo: TESTO_FINESTRA_SENZA_ALTEZZA,
    controlli: [
      { nome: 'cliente nome', verifica: (c) => c.cliente.nome === 'Crivellaro Mariano' },
      { nome: 'protocollo', verifica: (c) => c.protocollo === '2026059' },
      ...controlliFabbricato,
      {
        nome: 'portoncino 1 x 2,2 al piano terra',
        verifica: (c) =>
          (c.serramenti ?? []).some((s) => s.categoria === 'portoncino' && s.b === 1 && s.h === 2.2),
      },
      {
        nome: 'finestra senza altezza omessa',
        verifica: (c) => !(c.serramenti ?? []).some((s) => s.categoria !== 'portoncino' || s.b === 2),
      },
      { nome: 'un solo serramento', verifica: (c) => (c.serramenti ?? []).length === 1 },
    ],
  },
]

export interface EsitoControllo {
  caso: string
  controllo: string
  superato: boolean
}

// Un'estrazione fallita (JSON non valido, schema violato, errore di rete) boccia tutti i
// controlli del caso: dal punto di vista dell'operatore la chat non ha compilato nulla.
export function valutaCaso(caso: CasoValutazione, campi: CampiEstratti | null): EsitoControllo[] {
  return caso.controlli.map((controllo) => ({
    caso: caso.id,
    controllo: controllo.nome,
    superato: campi !== null && controllo.verifica(campi),
  }))
}
