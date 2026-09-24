// Casi AVVERSARI (scritti dopo lo sviluppo dei sistemi, mai visti da nessun candidato durante
// la messa a punto), angolo CONVERSAZIONE A TURNI E DISTRATTORI.
// Ogni testo è una conversazione dell'operatore in chat (turni utente uniti con "\n", come
// testoCumulativo in conversazione-apertura.ts). Misura tre regole di PROMPT_SISTEMA:
// - "se una stessa informazione compare più volte, usa l'ultima menzionata" (correzioni,
//   "anzi", "scusa volevo dire", dati ritirati);
// - "Non inventare valori": numeri che non sono campi (telefono, CAP, date, importi, catasto,
//   pratica edilizia, lotto) non devono finire in nessun campo;
// - un campo davvero assente (anche "da assegnare" o ritirato) resta vuoto ed è segnalato.
// Ogni controllo misura UNA regola e tollera le varianti di forma già misurate altrove
// (unità "mq"/"mm" in coda, maiuscole del nome piano, che la mappatura normalizza comunque).
import type { CampiEstratti } from '../estrazione'
import type { CasoValutazione } from '../valutazione-estrazione'
import { normalizzaNomePiano, risolviValoreLordo } from '@/domain/geometria'

type Superficie = CampiEstratti['superfici'][number]
type Serramento = NonNullable<CampiEstratti['serramenti']>[number]

const mancanti = (c: CampiEstratti) => c.campiMancanti.filter((x) => x !== 'luogo')
const parla = (c: CampiEstratti, campo: string) => mancanti(c).some((x) => x.toLowerCase().includes(campo.toLowerCase()))

const vicino = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-9

// Forma scritta senza spazi e senza unità in coda ("118 mq" -> "118", "100 + 60 mm" -> "100+60").
const valore = (s: Superficie) => s.valoreLordo.replace(/\s/g, '').replace(/(mq|m2|m²)$/i, '')
const mm = (x: string | undefined) => (x ?? '').replace(/\s/g, '').replace(/mm$/i, '')

const righe = (c: CampiEstratti, piano: string) => c.superfici.filter((s) => normalizzaNomePiano(s.piano) === piano)
const unaRiga = (c: CampiEstratti, piano: string, atteso: string) => {
  const r = righe(c, piano)
  return r.length === 1 && valore(r[0]) === atteso
}

const serramenti = (c: CampiEstratti): Serramento[] => c.serramenti ?? []
const conMisure = (s: Serramento, b: number, h: number) => vicino(s.b, b) && vicino(s.h, h)

const nessunoSpessore = (c: CampiEstratti) =>
  !c.spessoreEsterno && !c.spessoreInterno && !c.spessoreCoibente && !c.spessoreCappotto

export const CASI_AVVERSARI_CONVERSAZIONE: CasoValutazione[] = [
  {
    id: 'R-conv-correzioni-a-catena',
    testo: [
      'nuovo prev per Tonello Silvia, comune di Lonigo prov VI. pacchetto grezzo avanzato, tetto a falde, finitura intonaco',
      'scusa, il comune giusto è Brendola, non Lonigo (a Lonigo abita la figlia)',
      'sup: PT 112 mq, primo piano 96, portico 18 mq',
      'correggo: il piano terra è 118 mq non 112. e cambia la finitura, mettiamo rivestimento in larice',
      'protocollo 2026134, glielo mandiamo entro ven 3/10',
    ].join('\n'),
    controlli: [
      {
        nome: 'comune corretto al secondo turno: Brendola (VI), non Lonigo',
        verifica: (c) => c.cliente.comune?.trim() === 'Brendola' && c.cliente.provincia?.trim() === 'VI',
      },
      {
        nome: 'piano terra: vale la correzione 118, in una sola riga',
        verifica: (c) => unaRiga(c, 'Piano Terra', '118'),
      },
      {
        nome: 'superfici non corrette restano: Piano Primo 96, Portico 18, niente altro',
        verifica: (c) => unaRiga(c, 'Piano Primo', '96') && unaRiga(c, 'Portico', '18') && c.superfici.length === 3,
      },
      { nome: 'finitura cambiata in rivestimento', verifica: (c) => c.finituraEsterna === 'rivestimento' },
      {
        nome: 'copertura e pacchetto del primo turno non toccati dalle correzioni',
        verifica: (c) => c.tipoCopertura === 'falde' && c.pacchetto === 'grezzo avanzato',
      },
      { nome: 'protocollo dall ultimo turno, non la data 3/10', verifica: (c) => c.protocollo?.trim() === '2026134' },
      { nome: 'spessori mai citati: non inventati', verifica: nessunoSpessore },
    ],
  },
  {
    id: 'R-conv-distrattori-numerici',
    testo: [
      'Cliente Marchetto Denis, via Roma 14, 36075 Montecchio Maggiore (VI). cell 347 551 2089, mail denis.marchetto@example.it',
      'sopralluogo fatto il 18/09, vogliono la consegna entro marzo 2027. budget indicativo 285.000 € + iva',
      'catasto fg. 9 mapp. 1187, lotto di circa 900 mq. pratica edilizia n. 2026/0457 gia depositata in comune',
      'il ns protocollo è ancora da assegnare. superfici: piano terra 142 mq, garage 36 mq',
      'copertura piana, cappotto 120 mm. il resto lo sentiamo col progettista',
    ].join('\n'),
    controlli: [
      {
        nome: 'nome cliente senza indirizzo, telefono o mail',
        verifica: (c) =>
          c.cliente.nome.includes('Marchetto') &&
          c.cliente.nome.includes('Denis') &&
          !/[\d@]/.test(c.cliente.nome) &&
          !/via\s/i.test(c.cliente.nome),
      },
      {
        nome: 'comune dall indirizzo, non CAP né via',
        verifica: (c) => c.cliente.comune?.trim() === 'Montecchio Maggiore' && c.cliente.provincia?.trim() === 'VI',
      },
      {
        nome: 'protocollo da assegnare: assente (non pratica edilizia, catasto, telefono) e segnalato',
        verifica: (c) => !c.protocollo && parla(c, 'protocollo'),
      },
      {
        nome: 'superfici dei piani: Piano Terra 142 e Garage 36',
        verifica: (c) => unaRiga(c, 'Piano Terra', '142') && unaRiga(c, 'Garage', '36'),
      },
      {
        nome: 'il lotto di 900 mq non è una superficie di piano',
        verifica: (c) => !c.superfici.some((s) => valore(s).includes('900')),
      },
      {
        nome: 'cappotto 120, gli altri spessori non inventati',
        verifica: (c) => mm(c.spessoreCappotto) === '120' && !c.spessoreEsterno && !c.spessoreInterno && !c.spessoreCoibente,
      },
      { nome: 'progettista citato senza nome: non inventato', verifica: (c) => !c.progettista },
    ],
  },
  {
    id: 'R-conv-dati-ritirati',
    testo: [
      'prev. x Pegoraro Chiara, comune Arcugnano (VI). prot. 2026147. progettista geom. Luca Fabris',
      'superfici: piano terra 98 mq, piano primo 84 mq, garage 30, terrazzo 12 mq',
      'pacchetto chiavi in mano, copertura piana... anzi no, a falde. finitura intonaco',
      'aggiornamento dopo telefonata: il garage lo tolgono dal progetto. e il pacchetto non è più deciso, ci ripensano',
      "ah, il progettista non è più Fabris, passa all'arch. Ilaria Sartori",
    ].join('\n'),
    controlli: [
      {
        nome: 'garage ritirato: nessuna superficie garage',
        verifica: (c) => !righe(c, 'Garage').some((s) => risolviValoreLordo(valore(s)) > 0),
      },
      {
        nome: 'piani non ritirati restano: Piano Terra 98, Piano Primo 84, Terrazzo 12',
        verifica: (c) =>
          unaRiga(c, 'Piano Terra', '98') && unaRiga(c, 'Piano Primo', '84') && unaRiga(c, 'Terrazzo', '12'),
      },
      { nome: 'pacchetto ritirato: non più valorizzato', verifica: (c) => !c.pacchetto },
      { nome: 'pacchetto ritirato: segnalato mancante', verifica: (c) => parla(c, 'pacchetto') },
      { nome: 'copertura: vale l "anzi" -> falde', verifica: (c) => c.tipoCopertura === 'falde' },
      {
        nome: 'progettista: vale l ultima menzione (Sartori, non Fabris)',
        verifica: (c) => {
          const p = c.progettista ?? ''
          return p.includes('Ilaria') && p.includes('Sartori') && !p.includes('Fabris')
        },
      },
      { nome: 'protocollo abbreviato "prot." riconosciuto', verifica: (c) => c.protocollo?.trim() === '2026147' },
    ],
  },
  {
    id: 'R-conv-serramenti-spessori-a-turni',
    testo: [
      'Cliente Dal Maso Ivano, comune di Marostica (VI), protocollo 2026158. pacchetto grezzo, copertura a falde, rivestimento',
      'spessori: esterno 185 mm, interno 145, coibente 180',
      'scusa volevo dire esterno 225 mm. e il coibente fallo 100+60',
      'serramenti: al piano terra porta di ingresso base 1,1 m altezza 2,3 m, portafinestra al piano terra base 1,6 m altezza 2,4 m, al piano primo finestra base 1 m altezza 1,3 m',
      'la portafinestra del PT la facciamo alzante scorrevole, stessa base e altezza. la finestra del primo piano invece toglila. x dubbi tel. ufficio tecnico 0424 882170',
    ].join('\n'),
    controlli: [
      { nome: 'spessore esterno: vale la correzione 225', verifica: (c) => mm(c.spessoreEsterno) === '225' },
      { nome: 'coibente corretto nel composito 100+60', verifica: (c) => mm(c.spessoreCoibente) === '100+60' },
      {
        nome: 'interno non corretto resta 145, cappotto mai citato non inventato',
        verifica: (c) => mm(c.spessoreInterno) === '145' && !c.spessoreCappotto,
      },
      {
        nome: 'portoncino 1,1 x 2,3 non toccato dalle correzioni',
        verifica: (c) => serramenti(c).some((s) => s.categoria === 'portoncino' && conMisure(s, 1.1, 2.3)),
      },
      {
        nome: 'portafinestra diventata alzante scorrevole 1,6 x 2,4',
        verifica: (c) =>
          serramenti(c).some((s) => s.categoria === 'alzante-scorrevole' && conMisure(s, 1.6, 2.4)) &&
          !serramenti(c).some((s) => s.categoria === 'portafinestra-battente'),
      },
      {
        nome: 'finestra del piano primo ritirata',
        verifica: (c) =>
          !serramenti(c).some((s) => s.categoria === 'finestra-battente' || conMisure(s, 1, 1.3)),
      },
      { nome: 'protocollo non sovrascritto dal telefono', verifica: (c) => c.protocollo?.trim() === '2026158' },
    ],
  },
]
