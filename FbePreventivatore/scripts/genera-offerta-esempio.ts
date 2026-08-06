// scripts/genera-offerta-esempio.ts
//
// Genera un'offerta .docx reale dal golden case Crivellaro, per la verifica visiva
// umana in Word che `template/PLACEHOLDER.md` dichiara obbligatoria prima di usare
// il master con un cliente vero (in questo ambiente non c'è alcuna GUI: le verifiche
// automatiche si fermano al livello XML/struttura zip).
//
//   npx tsx scripts/genera-offerta-esempio.ts [percorso-output.docx]
//
// Import relativi e non con l'alias `@/`: così lo script gira con tsx senza
// dipendere dalla risoluzione dei path del tsconfig.

import path from 'node:path'
import { eseguiCalcolo, type InputCalcolo } from '../src/domain/calcolo'
import { CATALOGO_VOCI } from '../src/domain/voci'
import { LISTINO_2026 } from '../src/domain/listino'
import { generaAbacoSerramenti } from '../src/ai/abaco'
import { esportaOfferta, type InputEsportazione } from '../src/documento/export-docx'
import type { Serramento } from '../src/domain/geometria'

const INPUT_CRIVELLARO: InputCalcolo = {
  catalogo: CATALOGO_VOCI,
  configurazione: {
    livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
    numeroPianiAbitativi: 1,
    superficieGarage: 41,
    chiaviInManoNelTotale: true,
  },
  listino: LISTINO_2026,
  geometria: {
    superficiLordeTotale: 161,
    superficieSedime: 134,
    superficieGarage: 41,
    perimetro: 60,
    serramenti: { areaLordaTotale: 30.5, numero: 11 },
  },
  overrides: {
    'pareti-mhm': 96100, 'trave-larice': 5800, 'copertura-falda': 63600, cappotto: 20300,
    'cartongesso-q2': 15500, 'assistenza-cartongessisti': 2200, 'infissi-pvc': 19300,
    monoblocchi: 10200, 'progettazione-esecutiva': 4000, 'opere-chiavi-in-mano': 89100, garage: 20000,
  },
  sconti: [
    { percentuale: 0.1, causale: 'sconto cliente' },
    { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' },
  ],
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  arrotondamento: { risolviPerTotale: 300000 },
}

// I serramenti reali del caso Crivellaro (spec §3.6). Servono per far uscire un abaco
// coerente con gli 11 serramenti / 30,50 mq che il calcolo prezza: il fixture del test
// di export usa volutamente un solo portoncino, che è comodo per un assert ma darebbe
// una pagina 19 incoerente da guardare in Word.
const SERRAMENTI: Serramento[] = [
  { n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1.0, h: 2.2 },
  { n: 2, piano: 'PT', tipologia: 'finestra', b: 2.0, h: 1.8 },
  { n: 3, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 2.2 },
  { n: 4, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 5, piano: 'PT', tipologia: 'doppia finestra', b: 0.9, h: 1.2 },
  { n: 6, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 7, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 8, piano: 'PT', tipologia: 'finestra', b: 2.6, h: 2.2 },
  { n: 9, piano: 'PT', tipologia: 'finestra', b: 2.8, h: 2.2 },
  { n: 10, piano: 'PT', tipologia: 'portafinestra', b: 2.2, h: 2.2 },
  { n: 11, piano: 'PT', tipologia: 'finestra', b: 0.8, h: 2.1 },
]

const soloTipologia = (...tipologie: string[]) =>
  SERRAMENTI.filter((s) => tipologie.includes(s.tipologia))

const risultato = eseguiCalcolo(INPUT_CRIVELLARO)

const percorsoOutput = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), 'offerta-esempio-crivellaro.docx'),
)

const input: InputEsportazione = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  revisione: '00',
  dataOfferta: 'Castelgomberto, 6 agosto 2026',
  risultato,
  annoListino: LISTINO_2026.anno,
  caratteristiche: {
    tetto: 'Tetto con travi e perline in abete',
    mantoCopertura: 'Tegole in cemento',
    finituraEsterna: 'Intonaco',
    pacchettoConsegna: 'Grezzo avanzato',
  },
  superfici: {
    totaleLorda: '134+13+14= 161',
    pianoTerra: '134',
    pianoPrimo: '',
    sottotetto: '',
    portico: '13+14',
    terrazzo: '',
    garage: '41',
  },
  condizioni: {
    optional: [
      {
        id: 'pratica-genio-civile',
        lettera: 'A)',
        descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici',
        importo: 5000,
      },
    ],
    esclusioni: [
      { id: 'operaio-specializzato', lettera: 'a)', descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' },
    ],
    consegna: 'da pattuire',
    caparra: 30000,
    salPrimi: [
      { percentuale: 0.2, descrizione: 'Acconto al contratto' },
      { percentuale: 0.1, descrizione: 'Informativa di cantiere' },
      { percentuale: 0.4, descrizione: 'Inizio montaggio' },
    ],
    salSuccessivi: [
      { percentuale: 0.1, descrizione: 'Al tetto primo tavolato (escluso tegole)' },
      { percentuale: 0.1, descrizione: 'Cappotto esterno grezzo (escluso intonachino)' },
      { percentuale: 0.05, descrizione: 'Inizio posa Cartongesso' },
      { percentuale: 0.05, descrizione: 'Fine lavori' },
    ],
    validita: '31.08.2026',
  },
  abaco: {
    tutti: generaAbacoSerramenti(SERRAMENTI),
    finestreBattente: generaAbacoSerramenti(soloTipologia('finestra', 'doppia finestra')),
    portefinestreBattente: generaAbacoSerramenti(soloTipologia('portafinestra')),
    fissiVetrate: '',
    alzantiScorrevoli: '',
    portoncini: generaAbacoSerramenti(soloTipologia('porta di ingresso'), {
      prefisso: 'n. {n} portoncini di ingresso dim. standard {dim}',
    }),
  },
  percorsoMaster: path.resolve(import.meta.dirname, '../template/Offerta MHM master.docx'),
  percorsoOutput,
  // I 4 token {{spessore*}} del catalogo non sono ancora interpolati (follow-up noto):
  // senza questo opt-in `esportaOfferta` si rifiuta di produrre il documento.
  consentiPlaceholderNonRisolti: true,
}

esportaOfferta(input)

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })
console.log(`Listino ${LISTINO_2026.anno}   ${fmt(risultato.listinoTotale)}`)
for (const s of risultato.sconti) {
  console.log(`-${(s.percentuale * 100).toFixed(0)}% ${s.causale.padEnd(34)} - ${fmt(s.importoCalcolato)}`)
}
console.log(`arrotondamento             - ${fmt(risultato.arrotondamento)}`)
console.log(`PARZIALE                     ${fmt(risultato.parziale)}`)
console.log(`TOTALE NETTO                 ${fmt(risultato.totaleNetto)}`)
console.log(`\nVoci numerate: ${risultato.vociValorizzate.map((v) => v.numero).join(', ')}`)
console.log(`\nScritto ${percorsoOutput}`)
