import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import PizZip from 'pizzip'
import { esportaOfferta, type InputEsportazione } from './export-docx'
import { eseguiCalcolo, rilevaPlaceholderSpessoreNonInterpolati, type InputCalcolo } from '@/domain/calcolo'
import { CATALOGO_VOCI } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'

const PERCORSO_MASTER = path.resolve(import.meta.dirname, '../../template/Offerta MHM master.docx')

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

// Input di esportazione completo, riusato dai vari test sotto. Costruito da una funzione (non
// una costante) perché alcuni test lo alterano deliberatamente per riprodurre un campo
// mancante/errato — repro della review di Task 17 (Finding 1) — senza contaminarsi a vicenda.
function costruisciInputEsportazione(percorsoOutput: string): InputEsportazione {
  const risultato = eseguiCalcolo(INPUT_CRIVELLARO)
  return {
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
      // review Task 17 (Finding 2): senza un elemento con id 'pratica-genio-civile' qui,
      // {riferimenti.praticaGenioCivile} si risolve in stringa vuota e la frase fissa del
      // master ("...quotato al punto ) optional).") resta visibilmente rotta — nessun assert
      // negativo del test se ne accorgeva, perché non è un placeholder residuo né "undefined".
      optional: [
        { id: 'pratica-genio-civile', lettera: 'A)', descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici', importo: 5000 },
      ],
      // review Task 17 (Finding 3): un'esclusione a rapporto orario è un caso reale documentato
      // in PLACEHOLDER.md ("€ 35,00/ora") — VoceOpzionale.importo deve poterlo rappresentare.
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
      tutti: 'n. 1 portoncini di ingresso dim. standard 100x220;',
      finestreBattente: '',
      portefinestreBattente: '',
      fissiVetrate: '',
      alzantiScorrevoli: '',
      portoncini: 'n. 1 portoncini di ingresso dim. standard 100x220;',
    },
    percorsoMaster: PERCORSO_MASTER,
    percorsoOutput,
    // il golden case include pareti-mhm/cappotto/copertura-falda, le cui descrizioni portano
    // placeholder di spessore non interpolati (Finding 5) — opt-in esplicito e dichiarato.
    consentiPlaceholderNonRisolti: true,
  }
}

// Stesso golden case Crivellaro, ma con gli spessori compilati: l'export deve riuscire senza
// il residuo di sviluppo e SENZA il ricorso a `consentiPlaceholderNonRisolti` (Task 3/4 del
// fix ai placeholder di spessore non interpolati).
function costruisciInputEsportazioneConSpessoriCompilati(percorsoOutput: string): InputEsportazione {
  const risultatoConSpessori = eseguiCalcolo({
    ...INPUT_CRIVELLARO,
    spessori: { spessoreEsterno: '205', spessoreInterno: '160', spessoreCoibente: '200', spessoreCappotto: '140' },
  })
  return {
    ...costruisciInputEsportazione(percorsoOutput),
    risultato: risultatoConSpessori,
    consentiPlaceholderNonRisolti: undefined,
  }
}

function percorsoOutputTemporaneo(): string {
  return path.join(os.tmpdir(), `export-docx-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`)
}

describe('esportaOfferta — golden case Crivellaro', () => {
  it('produce un .docx con ogni placeholder sostituito e i totali corretti', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    try {
      esportaOfferta(costruisciInputEsportazione(percorsoOutput))

      const buffer = fs.readFileSync(percorsoOutput)
      const zip = new PizZip(buffer)
      const documentoXml = zip.file('word/document.xml')!.asText()
      // Word spezza il testo fisso del master in più <w:r> per via degli rsid di modifica: una
      // frase che attraversa testo fisso + valore inserito + testo fisso (es. "quotato al punto
      // {tag}) optional).") non è garantita contigua nell'XML grezzo, anche se lo è a schermo.
      // Per quelle frasi si confronta sul testo visibile (tag XML rimossi), non sull'XML grezzo.
      const testoVisibile = documentoXml.replace(/<[^>]+>/g, '')

      // --- valori rappresentativi per pagina (review Task 17, Finding 1) ---
      expect(documentoXml).toContain('Crivellaro Mariano') // copertina/pag. 4
      expect(documentoXml).toContain('134+13+14= 161') // pag. 4, superfici
      expect(documentoXml).toContain('Tegole in cemento') // pag. 4, caratteristiche
      expect(documentoXml).toContain('300 000,00') // pag. 5, totale netto
      expect(documentoXml).toContain('da pattuire') // pag. 6, consegna
      expect(documentoXml).toContain('30 000,00') // pag. 6, caparra
      expect(documentoXml).toContain('Al tetto primo tavolato') // pag. 6, SAL successivi
      expect(documentoXml).toContain('31.08.2026') // pag. 6, validità
      expect(documentoXml).toContain('n. 1 portoncini di ingresso dim. standard 100x220;') // pagg. 19-20, abaco

      // sconti col segno separato da uno spazio (PLACEHOLDER.md, PaginaPrezzi.tsx), non incollato al numero
      expect(documentoXml).toContain('- 23 700,00')
      expect(documentoXml).toContain('- 21 330,00')

      // review Task 17 (Finding 2): la frase fissa del master si completa con la lettera vera,
      // non con un buco silenzioso ("quotato al punto ) optional).")
      expect(testoVisibile).toContain('quotato al punto A) optional)')
      expect(testoVisibile).not.toContain('quotato al punto )')

      // review Task 17 (Finding 3): esclusione a importo testuale libero, non enumerabile
      expect(documentoXml).toContain('€ 35,00/ora')

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
      // questo task (nessun dato di spessore in InputEsportazione), sono già presenti tali e
      // quali nella preview (src/documento/preview/PaginaPrezzi.tsx), e qui sono ammesse solo
      // perché il test passa esplicitamente `consentiPlaceholderNonRisolti: true` (Finding 5) —
      // non vanno confusi con un vero placeholder sopravvissuto al render.
      const tagSopravvissuti = documentoXml.match(/(?<!\{)\{[#/]?[a-z][\w.]*\}(?!\})/g)
      expect(tagSopravvissuti).toBeNull()
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })
})

describe('esportaOfferta — chiavi non risolte nel master (review Task 17, Finding 1)', () => {
  it('lancia un errore leggibile invece di svuotare in silenzio una cella, se un campo richiesto arriva vuoto', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazione(percorsoOutput)
    // Simula un difetto a monte (es. un bug futuro nella mappatura da StatoForm) che lascia
    // `tetto` non definito: senza la strumentazione del nullGetter questo svuoterebbe
    // silenziosamente la cella "Tetto" a pag. 4 di un documento firmato dal cliente.
    input.caratteristiche.tetto = undefined as unknown as string

    try {
      expect(() => esportaOfferta(input)).toThrowError(/tetto/)
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })
})

describe('esportaOfferta — placeholder di spessore non interpolati (review Task 17, Finding 5)', () => {
  it('si blocca di default se le descrizioni contengono placeholder a doppia graffa mai interpolati', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazione(percorsoOutput)
    input.consentiPlaceholderNonRisolti = false

    try {
      expect(() => esportaOfferta(input)).toThrowError(/spessoreEsterno/)
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })

  it('rileva esattamente i quattro token noti, oggi non interpolati da nessun meccanismo', () => {
    const risultato = eseguiCalcolo(INPUT_CRIVELLARO)
    const trovati = rilevaPlaceholderSpessoreNonInterpolati(risultato.vociValorizzate)

    // Se in futuro qualcuno risolve il problema solo a metà (es. interpola lo spessore delle
    // pareti ma non quello del cappotto), questo assert deve accorgersene: l'insieme esatto dei
    // token, non solo "ce ne sono" o "non ce ne sono".
    expect(new Set(trovati)).toEqual(
      new Set(['{{spessoreEsterno}}', '{{spessoreInterno}}', '{{spessoreCoibente}}', '{{spessoreCappotto}}']),
    )
  })
})

describe('esportaOfferta — spessori compilati (fix follow-up ai placeholder)', () => {
  it('esporta senza errore e senza consentiPlaceholderNonRisolti quando tutti gli spessori sono forniti', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazioneConSpessoriCompilati(percorsoOutput)

    try {
      expect(() => esportaOfferta(input)).not.toThrow()

      const documentoXml = new PizZip(fs.readFileSync(percorsoOutput)).file('word/document.xml')!.asText()
      expect(documentoXml).toContain('sp. mm 205')
      expect(documentoXml).toContain('sp. mm 140')
      expect(documentoXml).not.toContain('{{spessoreEsterno}}')
      expect(documentoXml).not.toContain('{{spessoreInterno}}')
      expect(documentoXml).not.toContain('{{spessoreCoibente}}')
      expect(documentoXml).not.toContain('{{spessoreCappotto}}')
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })
})

describe('esportaOfferta — nessuna pratica Genio Civile marcata (review finale, Finding 2)', () => {
  it('si rifiuta di esportare se nessuna riga optional è marcata come pratica Genio Civile', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazione(percorsoOutput)
    input.condizioni.optional = []

    try {
      expect(() => esportaOfferta(input)).toThrowError(/pratica Genio Civile/)
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })
})

describe('esportaOfferta — campi obbligatori del documento firmabile mancanti (review finale, Finding 3)', () => {
  it('si rifiuta di esportare se "consegna" è vuoto', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazione(percorsoOutput)
    input.condizioni.consegna = ''

    try {
      expect(() => esportaOfferta(input)).toThrowError(/consegna/)
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })

  it('si rifiuta di esportare se "validità" è vuota', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazione(percorsoOutput)
    input.condizioni.validita = ''

    try {
      expect(() => esportaOfferta(input)).toThrowError(/validità/)
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })

  it('si rifiuta di esportare se "caparra" è pari a zero', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazione(percorsoOutput)
    input.condizioni.caparra = 0

    try {
      expect(() => esportaOfferta(input)).toThrowError(/caparra/)
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })
})
