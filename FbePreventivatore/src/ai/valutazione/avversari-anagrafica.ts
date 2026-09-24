// Casi AVVERSARI (scritti dopo lo sviluppo dei sistemi, mai visti da nessun candidato durante
// la messa a punto), angolo ANAGRAFICA, PIANI E NEGAZIONI: nomi con particelle o doppio nome,
// comuni di più parole con provincia tra parentesi o come sigla, piani detti con sinonimi,
// un piano non canonico, negazioni ("niente garage", "senza cappotto") e scelte dette a
// parole ("tetto piano", "due falde", "chiavi in mano completo").
// Ogni controllo segue in modo univoco da PROMPT_SISTEMA e dalle convenzioni dei casi
// esistenti; dove l'estrazione ammette più letture ragionevoli, non si controlla.
import type { CampiEstratti } from '../estrazione'
import type { CasoValutazione } from '../valutazione-estrazione'
import { PIANI_CANONICI } from '@/domain/geometria'

// Confronto tollerante per nomi e comuni: maiuscole, accenti, apostrofi tipografici e spazi
// multipli non sono la regola in prova (lo è non perdere particelle o parti del nome).
const norm = (s: string | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const nomeContiene = (c: CampiEstratti, ...parti: string[]) => parti.every((p) => norm(c.cliente.nome).includes(p))
const sigla = (c: CampiEstratti) => (c.cliente.provincia ?? '').trim().toUpperCase()

// "luogo" non conta mai (si deduce dal comune, vedi ChatApertura.tsx): si scarta ogni voce
// che lo nomini, anche se formulata diversamente ("luogo (dal comune)").
const mancanti = (c: CampiEstratti) =>
  c.campiMancanti.map((x) => x.toLowerCase()).filter((x) => !x.includes('luogo'))
const segnala = (c: CampiEstratti, ...sottostringhe: string[]) =>
  mancanti(c).some((x) => sottostringhe.some((s) => x.includes(s)))

// valoreLordo senza spazi; "mq" tollerato qui perché questi controlli misurano il nome del
// piano, non l'unità (stessa scelta del caso di controllo sui piani da normalizzare).
const valore = (v: string) => v.replace(/\s/g, '').replace(/mq\.?$/i, '')
const superficiePer = (c: CampiEstratti, piano: string) => {
  const righe = c.superfici.filter((s) => s.piano === piano)
  return righe.length === 1 ? valore(righe[0].valoreLordo) : undefined
}
const canonici: readonly string[] = PIANI_CANONICI

// Una negazione ("niente garage", "senza cappotto") non dice COME rappresentare l'assenza:
// omettere la voce oppure scrivere "0" sono letture entrambe ragionevoli e innocue a valle
// (superficieGarage e numeroPianiAbitativi contano 0). Univoco è solo che non resti un
// valore positivo, quindi si boccia solo una cifra diversa da zero.
const valorizzato = (v: string | undefined) => /[1-9]/.test(v ?? '')

// --- R-anag-1: particelle, doppio nome, comune di tre parole con (VI), sinonimi dei piani,
// negazioni su garage/portico/cappotto, copertura/finitura/pacchetto detti a parole.
const TESTO_1 = `nuovo prev. per la sig.ra De Marchi Anna Maria, Bassano del Grappa (VI). prot. 2026133, progettista geom. Dal Santo Piero
sup: pianterreno 88 mq, 1° piano 76 mq, sottotetto 32. niente garage, non c'è portico.
tetto a due falde, rivestimento esterno in legno, chiavi in mano completo. spessori est 185 int 120 coib 160, senza cappotto`

// --- R-anag-2: cliente con particella e progettista con particella, comune con "prov. PD",
// un piano NON canonico (piano interrato) da riportare com'è e segnalare, autorimessa/p.t.
const TESTO_2 = `Cliente Dal Santo Loris - San Pietro in Gu, prov. PD
protocollo 2026140, progettista arch. Lo Presti Carmela
Superfici: p.t. 102 mq, piano interrato 60 mq, terrazzo 18 mq, autorimessa 35 mq
tetto piano, finitura intonaco, pacchetto grezzo. Spessori: esterno 160, interno 100, coibente 140, cappotto 80+40`

// --- R-anag-3: provincia come sigla senza parentesi, piani negati, alternative negate
// ("NON a falde", "niente rivestimento", "non chiavi in mano"), spessori non ancora decisi.
const TESTO_3 = `casa x Dalla Costa Gian Paolo, Montecchio Maggiore VI
villetta su un piano solo: pianoterra 140 mq, niente primo piano, no garage.
copertura non a falde: tetto piano. finitura intonaco, niente rivestimento. pacchetto: non chiavi in mano, solo grezzo.
spessori ancora da decidere col progettista`

// --- R-anag-4: conversazione a turni in cui una negazione successiva toglie garage e
// cappotto già dati, e un turno aggiunge il sottotetto; progettista mai detto.
const TESTO_4 = [
  'Cliente Da Re Giorgio, Castelfranco Veneto (TV). Prot. 2026151. Sup.: PT 110, 1° piano 95, garage 38 mq, portico 20. Copertura a falde, rivestimento. Pacchetto grezzo avanzato. Spessori est 200 int 140 coib 180 cappotto 100',
  'correzione: il garage non lo fanno più, niente garage. e togli anche il cappotto, la fanno senza cappotto',
  'ah e il sottotetto c è, 45 mq. il portico resta',
].join('\n')

export const CASI_AVVERSARI_ANAGRAFICA: CasoValutazione[] = [
  {
    id: 'R-anag-1-particelle-sinonimi-negazioni',
    testo: TESTO_1,
    controlli: [
      {
        nome: 'nome cliente con particella e doppio nome, non confuso col progettista',
        verifica: (c) => nomeContiene(c, 'de marchi', 'anna maria') && !nomeContiene(c, 'dal santo'),
      },
      {
        nome: 'comune di tre parole senza (VI), provincia VI',
        verifica: (c) => norm(c.cliente.comune) === 'bassano del grappa' && sigla(c) === 'VI',
      },
      { nome: 'progettista con particella', verifica: (c) => norm(c.progettista).includes('dal santo') },
      {
        nome: 'pianterreno/1° piano/sottotetto -> nomi canonici',
        verifica: (c) =>
          superficiePer(c, 'Piano Terra') === '88' &&
          superficiePer(c, 'Piano Primo') === '76' &&
          superficiePer(c, 'Piano sottotetto') === '32',
      },
      {
        nome: 'niente garage / non c è portico: nessuna superficie valorizzata per loro',
        verifica: (c) =>
          !c.superfici.some((s) => /garage|portico|autorimessa|box/i.test(s.piano) && valorizzato(s.valoreLordo)),
      },
      {
        nome: 'due falde, rivestimento, chiavi in mano completo -> enum',
        verifica: (c) => c.tipoCopertura === 'falde' && c.finituraEsterna === 'rivestimento' && c.pacchetto === 'chiavi in mano',
      },
      { nome: 'senza cappotto: nessuno spessore di cappotto', verifica: (c) => !valorizzato(c.spessoreCappotto) },
    ],
  },
  {
    id: 'R-anag-2-piano-non-canonico',
    testo: TESTO_2,
    controlli: [
      {
        nome: 'nome cliente con particella, non confuso col progettista',
        verifica: (c) => nomeContiene(c, 'dal santo', 'loris') && !nomeContiene(c, 'lo presti'),
      },
      {
        nome: 'comune di quattro parole, provincia da "prov. PD"',
        verifica: (c) => norm(c.cliente.comune) === 'san pietro in gu' && sigla(c) === 'PD',
      },
      {
        nome: 'p.t./terrazzo/autorimessa -> nomi canonici',
        verifica: (c) =>
          superficiePer(c, 'Piano Terra') === '102' &&
          superficiePer(c, 'Terrazzo') === '18' &&
          superficiePer(c, 'Garage') === '35',
      },
      {
        nome: 'piano interrato riportato com è, non ricondotto a un canonico',
        verifica: (c) =>
          c.superfici.some((s) => norm(s.piano).includes('interrato') && !canonici.includes(s.piano) && valore(s.valoreLordo) === '60'),
      },
      {
        nome: 'piano interrato segnalato in campiMancanti',
        verifica: (c) => segnala(c, 'interrato', 'piano', 'superfic'),
      },
      {
        nome: 'tetto piano, intonaco, grezzo -> enum',
        verifica: (c) => c.tipoCopertura === 'piano' && c.finituraEsterna === 'intonaco' && c.pacchetto === 'grezzo',
      },
      {
        nome: 'nessun campo presente segnalato mancante',
        verifica: (c) =>
          !segnala(c, 'protocollo', 'progettista', 'comune', 'provincia', 'copertura', 'finitura', 'pacchetto', 'spessore'),
      },
    ],
  },
  {
    id: 'R-anag-3-alternative-negate',
    testo: TESTO_3,
    controlli: [
      {
        nome: 'nome cliente con particella e doppio nome',
        verifica: (c) => {
          const compatto = norm(c.cliente.nome).replace(/\s/g, '')
          return compatto.includes('dallacosta') && compatto.includes('gianpaolo')
        },
      },
      {
        nome: 'comune "Montecchio Maggiore VI": sigla separata dal comune',
        verifica: (c) => norm(c.cliente.comune) === 'montecchio maggiore' && sigla(c) === 'VI',
      },
      { nome: 'pianoterra -> Piano Terra 140', verifica: (c) => superficiePer(c, 'Piano Terra') === '140' },
      {
        nome: 'niente primo piano / no garage: nessuna altra superficie valorizzata',
        verifica: (c) => c.superfici.every((s) => s.piano === 'Piano Terra' || !valorizzato(s.valoreLordo)),
      },
      { nome: 'copertura "non a falde: tetto piano" -> piano', verifica: (c) => c.tipoCopertura === 'piano' },
      {
        nome: 'alternative negate: intonaco (non rivestimento), grezzo (non chiavi in mano)',
        verifica: (c) => c.finituraEsterna === 'intonaco' && c.pacchetto === 'grezzo',
      },
      {
        // "da decidere" riportato come testo è una lettura possibile di "riportali come scritti";
        // univoco è solo che non compaia nessuna misura.
        nome: 'spessori da decidere: nessuna misura inventata',
        verifica: (c) =>
          ![c.spessoreEsterno, c.spessoreInterno, c.spessoreCoibente, c.spessoreCappotto].some((v) => /\d/.test(v ?? '')),
      },
    ],
  },
  {
    id: 'R-anag-4-negazione-a-turni',
    testo: TESTO_4,
    controlli: [
      { nome: 'nome cliente con particella corta "Da Re"', verifica: (c) => nomeContiene(c, 'da re', 'giorgio') },
      {
        nome: 'comune di due parole senza (TV), provincia TV',
        verifica: (c) => norm(c.cliente.comune) === 'castelfranco veneto' && sigla(c) === 'TV',
      },
      {
        nome: 'garage tolto al secondo turno: nessuna superficie garage valorizzata',
        verifica: (c) => !c.superfici.some((s) => /garage|autorimessa|box/i.test(s.piano) && valorizzato(s.valoreLordo)),
      },
      { nome: 'sottotetto aggiunto al terzo turno: Piano sottotetto 45', verifica: (c) => superficiePer(c, 'Piano sottotetto') === '45' },
      {
        nome: 'piani non toccati dalle correzioni restano: PT 110, 1° piano 95, portico 20',
        verifica: (c) =>
          superficiePer(c, 'Piano Terra') === '110' &&
          superficiePer(c, 'Piano Primo') === '95' &&
          superficiePer(c, 'Portico') === '20',
      },
      { nome: 'cappotto tolto al secondo turno: nessuno spessore di cappotto', verifica: (c) => !valorizzato(c.spessoreCappotto) },
      {
        nome: 'progettista mai detto: non inventato e segnalato',
        verifica: (c) => !c.progettista && segnala(c, 'progettista'),
      },
    ],
  },
]
