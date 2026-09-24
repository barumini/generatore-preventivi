// Casi di CONTROLLO: scritti a parte rispetto ai 3 casi Crivellaro di sviluppo
// (valutazione-estrazione.ts), misurano se un sistema di estrazione generalizza oltre quelli.
// Non vanno usati per ritoccare prompt o esempi few-shot: un sistema messo a punto su questi
// casi li supera per costruzione e l'insieme smette di misurare la generalizzazione.
import type { CampiEstratti } from '../estrazione'
import type { CasoValutazione } from '../valutazione-estrazione'

const mancanti = (c: CampiEstratti) => c.campiMancanti.filter((x) => x !== 'luogo')
const parla = (c: CampiEstratti, campo: string) => mancanti(c).some((x) => x.toLowerCase().includes(campo.toLowerCase()))

const BASE = `Preventivo per il cliente Crivellaro Mariano, comune di Trissino, provincia VI.
Protocollo 2026059. Progettista: arch. Paolo Bianchi. Luogo del cantiere: Trissino.
Superfici: Piano Terra 134 mq, Portico 13+14 mq, Garage 41 mq.
Copertura a falde, finitura esterna a intonaco. Pacchetto grezzo avanzato.
Spessori: esterno 205 mm, interno 160 mm, coibente 200 mm, cappotto 140 mm.`

export const CASI_CONTROLLO: CasoValutazione[] = [
  {
    id: 'N1-pareti-falda',
    testo: `${BASE}\nHa una parete esterna di base 12,5 m, altezza 2,7 m, spessore 20 mm. La copertura ha una falda con notazione 5,8x16,5 x17,1.`,
    controlli: [
      { nome: 'una parete E 12.5x2.7 sp 20', verifica: (c) => c.pareti?.length === 1 && c.pareti[0].tipo === 'E' && c.pareti[0].b === 12.5 && c.pareti[0].h === 2.7 && c.pareti[0].spessore === 20 },
      { nome: 'falda con notazione testuale', verifica: (c) => (c.falde ?? []).some((f) => f.notazione.replace(/\s/g, '') === '5,8x16,5x17,1') },
      { nome: 'nessun serramento/trave inventato', verifica: (c) => !c.serramenti?.length && !c.travi?.length },
      { nome: 'spessori ancora corretti', verifica: (c) => c.spessoreEsterno === '205' && c.spessoreCappotto === '140' },
      { nome: 'nessun mancante', verifica: (c) => mancanti(c).length === 0 },
    ],
  },
  {
    id: 'N2-multi-turno',
    testo: `Cliente Bortolan Giulia, comune di Schio, provincia VI. Pacchetto grezzo, copertura piana.\nAnzi, facciamo chiavi in mano. Il protocollo è 2026071.`,
    controlli: [
      { nome: 'nome e comune', verifica: (c) => c.cliente.nome === 'Bortolan Giulia' && c.cliente.comune === 'Schio' && c.cliente.provincia === 'VI' },
      { nome: 'ultima menzione vince: chiavi in mano', verifica: (c) => c.pacchetto === 'chiavi in mano' },
      { nome: 'protocollo dal secondo turno', verifica: (c) => c.protocollo === '2026071' },
      { nome: 'copertura piano', verifica: (c) => c.tipoCopertura === 'piano' },
      { nome: 'finitura non inventata', verifica: (c) => !c.finituraEsterna },
      { nome: 'spessori non inventati', verifica: (c) => !c.spessoreEsterno && !c.spessoreInterno && !c.spessoreCoibente && !c.spessoreCappotto },
      { nome: 'superfici non inventate', verifica: (c) => c.superfici.length === 0 },
      { nome: 'finitura segnalata mancante', verifica: (c) => parla(c, 'finitura') },
    ],
  },
  {
    id: 'N3-piani-da-normalizzare',
    testo: 'Casa per Zanella Marco a Thiene (VI). Superfici: PT 120 mq, primo piano 80 mq, mansarda 40, box auto 30 mq. Finitura a rivestimento.',
    controlli: [
      {
        nome: 'piani canonici',
        verifica: (c) => {
          const m = Object.fromEntries(c.superfici.map((s) => [s.piano, s.valoreLordo.replace(/\s*mq/i, '')]))
          return m['Piano Terra'] === '120' && m['Piano Primo'] === '80' && m['Piano sottotetto'] === '40' && m['Garage'] === '30' && c.superfici.length === 4
        },
      },
      { nome: 'finitura rivestimento', verifica: (c) => c.finituraEsterna === 'rivestimento' },
      { nome: 'protocollo non inventato e segnalato', verifica: (c) => !c.protocollo && parla(c, 'protocollo') },
      { nome: 'copertura e pacchetto non inventati', verifica: (c) => !c.tipoCopertura && !c.pacchetto },
      { nome: 'copertura segnalata mancante', verifica: (c) => parla(c, 'copertura') },
    ],
  },
  {
    id: 'N4-serramenti-misti',
    testo: `${BASE}\nAl piano primo una finestra 1,2 x 1,4 m e una portafinestra di base 0,9 m e altezza 2,4 m. In soggiorno un alzante scorrevole di base 3 m, altezza da definire.`,
    controlli: [
      { nome: 'finestra 1.2x1.4', verifica: (c) => (c.serramenti ?? []).some((s) => s.categoria === 'finestra-battente' && s.b === 1.2 && s.h === 1.4) },
      { nome: 'portafinestra 0.9x2.4', verifica: (c) => (c.serramenti ?? []).some((s) => s.categoria === 'portafinestra-battente' && s.b === 0.9 && s.h === 2.4) },
      { nome: 'alzante senza altezza omesso', verifica: (c) => !(c.serramenti ?? []).some((s) => s.categoria === 'alzante-scorrevole' || s.b === 3) },
      { nome: 'due serramenti', verifica: (c) => (c.serramenti ?? []).length === 2 },
    ],
  },
  {
    id: 'N5-minimo',
    testo: 'Casa per Rossi Giovanni.',
    controlli: [
      { nome: 'nome', verifica: (c) => c.cliente.nome === 'Rossi Giovanni' },
      { nome: 'comune/provincia non inventati', verifica: (c) => !c.cliente.comune && !c.cliente.provincia },
      { nome: 'nulla inventato', verifica: (c) => !c.protocollo && !c.progettista && c.superfici.length === 0 && !c.tipoCopertura && !c.pacchetto && !c.finituraEsterna && !c.spessoreEsterno },
      { nome: 'protocollo e superfici segnalati', verifica: (c) => parla(c, 'protocollo') && parla(c, 'superfici') },
    ],
  },
]
