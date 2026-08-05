// template/spike/spike-master.ts
//
// Step 4 del Task 16: ripete lo spike del Task 2 sul master definitivo
// (template/Offerta MHM master.docx), con dati di test fittizi su TUTTI i
// placeholder di template/PLACEHOLDER.md, inclusi i cicli su righe di tabella.
//
// Verifica, oltre all'assenza di eccezioni:
//  - nessun placeholder residuo `{...}` nell'output;
//  - nessun "undefined" (il nullGetter di default di docxtemplater stampa
//    "undefined" per un tag semplice senza dato: se compare, manca un dato);
//  - i cicli hanno prodotto esattamente N righe, non 1 e non 0.
//
// Nota sui nomi con il punto: il parser di default di docxtemplater NON
// risolve i path annidati ({cliente.nome} non legge cliente.nome), quindi i
// dati sono passati come chiavi PIATTE che contengono il punto. In
// alternativa si configura `parser` con docxtemplater/expressions.js
// (richiede la dipendenza angular-expressions, oggi non installata).
import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const percorsoMaster = path.resolve(import.meta.dirname, '..', 'Offerta MHM master.docx')
const percorsoOutput = path.resolve(import.meta.dirname, 'output-master.docx')

const dati = {
  // copertina + header
  'cliente.nome': 'Crivellaro Giovanni',
  'cliente.comune': 'Zanè',
  'cliente.provincia': 'VI',
  protocollo: '2026059',
  revisione: '04',
  // pag. 4
  dataOfferta: '5 agosto 2026',
  sistemaCostruttivo: 'MassivHolzMauer® (M.H.M.)',
  tetto: 'Tetto con travi e perline in abete',
  mantoCopertura: 'Tegole in cemento',
  finituraEsterna: 'Intonaco',
  pacchettoConsegna: 'Grezzo avanzato',
  'superficie.totaleLorda': '134+13+14= 161',
  'superficie.pianoTerra': '134',
  'superficie.pianoPrimo': '',
  'superficie.sottotetto': '',
  'superficie.portico': '13+14',
  'superficie.terrazzo': '',
  'superficie.garage': '41',
  // pag. 5 — tabella prezzi nativa
  voci: [
    { numero: '1', descrizione: 'Pareti strutturali in legno "M.H.M." esterne sp. mm 205', importo: '96 100,00 €' },
    { numero: '1.a', descrizione: 'Tracciamento impianto idrosanitario ed elettrico', importo: 'comprese' },
    { numero: '2', descrizione: 'Copertura a falda in travi e tavolato lato inferiore a vista', importo: '140 900,00 €' },
  ],
  annoListino: '2026',
  listinoTotale: '237 000,00 €',
  sconti: [
    { percentuale: '10%', causale: 'sconto cliente', importo: '- 23 700,00 €' },
    { percentuale: '10%', causale: 'per conferme entro il 31.07.2026', importo: '- 21 330,00 €' },
  ],
  arrotondamento: '- 1 070,00 €',
  parziale: '190 900,00 €',
  'sicurezza.valorizzata': '2 000,00 €',
  vociPostSconto: [
    { numero: '8', descrizione: 'Stima opere chiavi in mano', importo: '95 100,00 €' },
    { numero: '9', descrizione: 'Garage realizzato con struttura a telaio portante', importo: '12 000,00 €' },
  ],
  totaleNetto: '300 000,00 €',
  optional: [
    { lettera: 'A)', descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici', importo: '5 000,00 €' },
    { lettera: 'B)', descrizione: 'Scala interna grezza in x-lam tipo standard FBE', importo: '5 500,00 €' },
  ],
  esclusioni: [
    { lettera: 'a)', descrizione: 'Gru da cantiere', importo: 'escluso' },
    { lettera: 'b)', descrizione: 'Ponteggio', importo: 'escluso' },
    { lettera: 'c)', descrizione: 'Operaio specializzato - ore in economia', importo: '€ 35,00/ora' },
  ],
  // pag. 6
  'riferimenti.praticaGenioCivile': 'A',
  'riferimenti.tracciamentoImpianti': '1.a',
  'riferimenti.progettazioneEsecutiva': '7',
  consegna: 'da pattuire',
  caparra: '10 000,00',
  salPrimi: [
    { percentuale: '20%', descrizione: 'Acconto al contratto' },
    { percentuale: '10%', descrizione: 'Informativa di cantiere' },
    { percentuale: '40%', descrizione: 'Inizio montaggio' },
  ],
  salSuccessivi: [
    { percentuale: '10%', descrizione: 'Al tetto primo tavolato (escluso tegole)' },
    { percentuale: '10%', descrizione: 'Cappotto esterno grezzo (escluso intonachino)' },
    { percentuale: '5%', descrizione: 'Inizio posa Cartongesso' },
    { percentuale: '5%', descrizione: 'Fine lavori' },
  ],
  validita: '31.08.2026',
  // pagg. 19-20
  'abaco.finestreBattente': 'n. 1 dim. 130x110; n. 3 dim. 50x140;',
  'abaco.portefinestreBattente': 'n. 1 dim. 130x205;',
  'abaco.fissiVetrate': 'n. 1 dim. 50x240;',
  'abaco.alzantiScorrevoli': 'n. 1 dim. 240x230;',
  abacoSerramenti: 'n. 1 dim. 130x110; n. 3 dim. 50x140; n. 1 dim. 130x205; n. 1 dim. 240x230;',
  'abaco.portoncini': 'n. 1 portoncini di ingresso dim. standard 90x230',
}

const contenuto = fs.readFileSync(percorsoMaster, 'binary')
const zip = new PizZip(contenuto)
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

doc.render(dati)

const buffer = doc.getZip().generate({ type: 'nodebuffer' })
fs.writeFileSync(percorsoOutput, buffer)

// ---- controlli sull'XML prodotto -----------------------------------------
const xml = doc.getZip().file('word/document.xml')!.asText()
// docxtemplater fa l'escaping XML dei valori iniettati (es. `"` -> `&quot;`):
// per confrontare col testo atteso le entità vanno decodificate.
const testi = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
  .map((m) => m[1])
  .join('')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')

const problemi: string[] = []

const residui = testi.match(/\{[^{}]*\}/g)
if (residui) problemi.push(`placeholder residui: ${[...new Set(residui)].join(', ')}`)
if (testi.includes('undefined')) problemi.push('presente "undefined": un dato non è stato passato')

const conta = (frammento: string) => testi.split(frammento).length - 1
const attesi: Array<[string, string, number]> = [
  ['voci', 'Pareti strutturali in legno "M.H.M." esterne sp. mm 205', 1],
  ['voci', 'Tracciamento impianto idrosanitario ed elettrico', 1],
  ['voci', 'Copertura a falda in travi e tavolato lato inferiore a vista', 1],
  ['sconti', 'SCONTO RISERVATO: 10%', 2],
  ['vociPostSconto', 'Stima opere chiavi in mano', 1],
  ['vociPostSconto', 'Garage realizzato con struttura a telaio portante', 1],
  ['optional', 'Pratica per deposito al Genio Civile dei calcoli sismici', 1],
  ['esclusioni', 'Operaio specializzato - ore in economia', 1],
  ['salPrimi', 'Informativa di cantiere', 1],
  ['salSuccessivi', 'Fine lavori', 1],
]
for (const [ciclo, frammento, atteso] of attesi) {
  const trovate = conta(frammento)
  if (trovate !== atteso) problemi.push(`ciclo ${ciclo}: "${frammento}" atteso ${atteso}x, trovato ${trovate}x`)
}

// numero di righe della tabella prezzi: 13 righe-modello - 5 righe di ciclo
// + (3 voci + 2 sconti + 2 postSconto + 2 optional + 3 esclusioni) = 20
const righeTotali = (xml.match(/<w:tr(?:>| )/g) ?? []).length
console.log('Scritto', percorsoOutput)
console.log('righe <w:tr> totali nel documento:', righeTotali)

if (problemi.length > 0) {
  console.error('PROBLEMI:\n - ' + problemi.join('\n - '))
  process.exit(1)
}
console.log('Nessun placeholder residuo, nessun "undefined", cicli espansi come atteso.')
