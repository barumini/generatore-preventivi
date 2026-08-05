import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import { esportaOfferta } from './export-docx'
import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { CATALOGO_VOCI } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'

const INPUT_CRIVELLARO: InputCalcolo = {
  catalogo: CATALOGO_VOCI,
  configurazione: {
    livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
    numeroPianiAbitativi: 1,
    superficieGarage: 41,
    chiaviInManoNelTotale: true, // amendment Task 5 — mancava nel brief originale
  },
  listino: LISTINO_2026,
  geometria: {
    superficiLordeTotale: 161,
    superficieSedime: 134, // amendment Task 6 — mancava nel brief originale
    superficieGarage: 41,
    perimetro: 60,
    serramenti: { areaLordaTotale: 30.5, numero: 11 },
  },
  overrides: {
    'pareti-mhm': 96100, 'trave-larice': 5800, 'copertura-falda': 63600, cappotto: 20300,
    'cartongesso-q2': 15500, 'assistenza-cartongessisti': 2200, 'infissi-pvc': 19300,
    monoblocchi: 10200, 'progettazione-esecutiva': 4000, 'opere-chiavi-in-mano': 89100, garage: 20000,
  },
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }, { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' }],
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  arrotondamento: { risolviPerTotale: 300000 },
}

describe('esportaOfferta — golden case Crivellaro', () => {
  it('produce un .docx con ogni placeholder sostituito e i totali corretti', () => {
    const risultato = eseguiCalcolo(INPUT_CRIVELLARO)
    const percorsoOutput = path.resolve(import.meta.dirname, '__output_test__.docx')

    esportaOfferta({
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      revisione: '00',
      dataOfferta: 'Castelgomberto, 5 agosto 2026',
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
        optional: [],
        esclusioni: [],
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
        tutti: 'n. 1 portoncini di ingresso dim. standard 100x220;',
        finestreBattente: '',
        portefinestreBattente: '',
        fissiVetrate: '',
        alzantiScorrevoli: '',
        portoncini: 'n. 1 portoncini di ingresso dim. standard 100x220;',
      },
      percorsoMaster: path.resolve(import.meta.dirname, '../../template/Offerta MHM master.docx'),
      percorsoOutput,
    })

    const buffer = fs.readFileSync(percorsoOutput)
    const zip = new PizZip(buffer)
    const documentoXml = zip.file('word/document.xml')!.asText()

    expect(documentoXml).toContain('Crivellaro Mariano')
    expect(documentoXml).toContain('300 000,00')
    // sconti col segno separato da uno spazio (PLACEHOLDER.md, PaginaPrezzi.tsx), non incollato al numero
    expect(documentoXml).toContain('- 23 700,00')
    expect(documentoXml).toContain('- 21 330,00')
    // nessun placeholder o residuo del bug di spec §3.8 deve sopravvivere al render
    expect(documentoXml).not.toContain('{cliente.nome}')
    expect(documentoXml).not.toContain('{riferimenti.')
    expect(documentoXml).not.toContain('{#')
    expect(documentoXml).not.toContain('undefined')
    expect(documentoXml).not.toContain('PROT. 000-22 REV.00')
    // NB: non si verifica `not.toContain('punto 1.a')` come nel brief originale: nel golden
    // case Crivellaro 'tracciamento-impianti' è sottovoce di 'pareti-mhm' (voce 1), quindi
    // numeraVoci() lo numera legittimamente '1.a' (CLAUDE.md vincolo 4) — il testo fisso del
    // master "indicate al punto {riferimenti.tracciamentoImpianti}" produce correttamente
    // "indicate al punto 1.a", coincidenza col vecchio valore hardcoded, non un residuo. Il
    // controllo che conta — che il TAG non sia rimasto letterale — è già sopra
    // (`not.toContain('{riferimenti.')`) e nel controllo generale sotto.

    // Controllo generale: nessun tag docxtemplater a singola graffa deve sopravvivere.
    // Le sequenze a doppia graffa tipo {{spessoreEsterno}} sono placeholder testuali del
    // catalogo voci (src/domain/voci.ts), non tag docxtemplater: non sono nello scope di
    // questo task (nessun dato di spessore in InputEsportazione) e sono già presenti tali
    // e quali nella preview (src/documento/preview/PaginaPrezzi.tsx) — non vanno confusi
    // con un vero placeholder sopravvissuto al render.
    const tagSopravvissuti = documentoXml.match(/(?<!\{)\{[#/]?[a-z][\w.]*\}(?!\})/g)
    expect(tagSopravvissuti).toBeNull()

    fs.unlinkSync(percorsoOutput)
  })
})
