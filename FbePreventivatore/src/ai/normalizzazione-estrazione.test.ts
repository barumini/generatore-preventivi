import { describe, expect, it } from 'vitest'
import {
  controllaForma,
  normalizzaEstrazione,
  parsaJsonTollerante,
  verificaNomeCliente,
  type Grezzo,
} from './normalizzazione-estrazione'
import { SchemaCampiEstratti } from './estrazione'

// Risposta "vuota" nella forma chiesta dal prompt: tutte le chiavi presenti, nessun dato.
// Ogni test sovrascrive solo quello che gli serve.
const VUOTA: Grezzo = {
  cliente: { nome: null, comune: null, provincia: null },
  protocollo: null,
  progettista: null,
  luogo: null,
  superfici: [],
  tipoCopertura: null,
  finituraEsterna: null,
  pacchetto: null,
  spessoreEsterno: null,
  spessoreInterno: null,
  spessoreCoibente: null,
  spessoreCappotto: null,
  pareti: [],
  falde: [],
  travi: [],
  serramenti: [],
}

const CRIVELLARO = `Preventivo per il cliente Crivellaro Mariano, comune di Trissino, provincia VI.
Protocollo 2026059. Progettista: arch. Paolo Bianchi. Luogo del cantiere: Trissino.
Superfici: Piano Terra 134 mq, Portico 13+14 mq, Garage 41 mq.
Copertura a falde, finitura esterna a intonaco. Pacchetto grezzo avanzato.
Spessori: esterno 205 mm, interno 160 mm, coibente 200 mm, cappotto 140 mm.`

function normalizza(parziale: Grezzo, testo: string) {
  return normalizzaEstrazione({ ...VUOTA, ...parziale }, testo)
}

describe('normalizzaEstrazione', () => {
  it('riporta il caso Crivellaro alla forma del preventivo, senza campi mancanti', () => {
    const campi = normalizza(
      {
        cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
        protocollo: '2026059',
        progettista: 'arch. Paolo Bianchi',
        luogo: 'Trissino',
        superfici: [
          { piano: 'Piano Terra', valoreLordo: '134 mq' },
          { piano: 'Portico', valoreLordo: '13+14 mq' },
          { piano: 'Garage', valoreLordo: '41' },
        ],
        tipoCopertura: 'falde',
        finituraEsterna: 'intonaco',
        pacchetto: 'grezzo avanzato',
        spessoreEsterno: '205 mm',
        spessoreInterno: '160',
        spessoreCoibente: '200',
        spessoreCappotto: '140 mm',
      },
      CRIVELLARO,
    )

    expect(campi).toEqual({
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      progettista: 'arch. Paolo Bianchi',
      luogo: 'Trissino',
      superfici: [
        { piano: 'Piano Terra', valoreLordo: '134' },
        { piano: 'Portico', valoreLordo: '13+14' },
        { piano: 'Garage', valoreLordo: '41' },
      ],
      tipoCopertura: 'falde',
      finituraEsterna: 'intonaco',
      pacchetto: 'grezzo avanzato',
      spessoreEsterno: '205',
      spessoreInterno: '160',
      spessoreCoibente: '200',
      spessoreCappotto: '140',
      campiMancanti: [],
    })
    // Il risultato deve passare lo schema di produzione così com'è.
    expect(SchemaCampiEstratti.safeParse(campi).success).toBe(true)
  })

  it('calcola campiMancanti in codice, nell\'ordine del preventivo, e ignora quelli del modello', () => {
    const campi = normalizza({ campiMancanti: ['luogo', 'serramenti'] }, 'testo senza dati')

    expect(campi.campiMancanti).toEqual([
      'cliente.nome',
      'cliente.comune',
      'cliente.provincia',
      'protocollo',
      'progettista',
      'tipoCopertura',
      'finituraEsterna',
      'pacchetto',
      'spessoreEsterno',
      'spessoreInterno',
      'spessoreCoibente',
      'spessoreCappotto',
      'superfici',
    ])
  })

  it('non segnala mai "luogo" tra i mancanti: si deduce dal comune', () => {
    const campi = normalizza({ cliente: { nome: 'Rossi', comune: 'Schio', provincia: 'VI' } }, 'Rossi, Schio (VI)')

    expect(campi.luogo).toBeUndefined()
    expect(campi.campiMancanti).not.toContain('luogo')
  })

  it('tratta come assenti i segnaposto del modello ("n/d", "non specificato", stringa vuota)', () => {
    const campi = normalizza(
      { cliente: { nome: 'Rossi', comune: 'n/d', provincia: '' }, progettista: 'non specificato', pacchetto: 'null' },
      'casa per Rossi',
    )

    expect(campi.cliente).toEqual({ nome: 'Rossi' })
    expect(campi.progettista).toBeUndefined()
    expect(campi.pacchetto).toBeUndefined()
    expect(campi.campiMancanti).toEqual(expect.arrayContaining(['cliente.comune', 'cliente.provincia', 'progettista', 'pacchetto']))
  })

  describe('anagrafica senza riscontro nel testo', () => {
    it('scarta un protocollo che il testo non contiene', () => {
      const campi = normalizza({ protocollo: '2026060' }, CRIVELLARO)

      expect(campi.protocollo).toBeUndefined()
      expect(campi.campiMancanti).toContain('protocollo')
    })

    it('accetta un protocollo scritto con spazi o punteggiatura diversi', () => {
      expect(normalizza({ protocollo: '2026059' }, 'prot. n. 2026-059').protocollo).toBe('2026059')
    })

    it('scarta un progettista che non compare nel testo, titolo a parte', () => {
      expect(normalizza({ progettista: 'ing. Carlo Neri' }, CRIVELLARO).progettista).toBeUndefined()
    })

    it('conserva il progettista come lo scrive il modello se almeno una parola del nome è nel testo', () => {
      expect(normalizza({ progettista: 'arch. Paolo Bianchi' }, 'progettista architetto Bianchi').progettista).toBe(
        'arch. Paolo Bianchi',
      )
    })
  })

  describe('superfici', () => {
    it('toglie le unità ma conserva la forma scritta del valore', () => {
      const campi = normalizza(
        {
          superfici: [
            { piano: 'Piano Terra', valoreLordo: '134 mq' },
            { piano: 'Portico', valoreLordo: '13+14 m²' },
            { piano: 'Garage', valoreLordo: '41 metri quadrati' },
          ],
        },
        CRIVELLARO,
      )

      expect(campi.superfici).toEqual([
        { piano: 'Piano Terra', valoreLordo: '134' },
        { piano: 'Portico', valoreLordo: '13+14' },
        { piano: 'Garage', valoreLordo: '41' },
      ])
    })

    it('riporta i nomi dei piani alla forma canonica', () => {
      const campi = normalizza(
        {
          superfici: [
            { piano: 'pianterreno', valoreLordo: '110' },
            { piano: 'primo piano', valoreLordo: '80' },
            { piano: 'mansarda', valoreLordo: '64' },
            { piano: 'box auto', valoreLordo: '30' },
          ],
        },
        'pianterreno 110 mq, primo piano 80 mq, mansarda 64 mq, box auto 30 mq',
      )

      expect(campi.superfici.map((s) => s.piano)).toEqual(['Piano Terra', 'Piano Primo', 'Piano sottotetto', 'Garage'])
    })

    it('conserva un piano non canonico com\'è scritto e lo segnala in campiMancanti', () => {
      const campi = normalizza(
        { superfici: [{ piano: 'Piano Terra', valoreLordo: '96' }, { piano: 'Cantina', valoreLordo: '30' }] },
        'piano terra 96 mq e cantina 30 mq',
      )

      expect(campi.superfici).toContainEqual({ piano: 'Cantina', valoreLordo: '30' })
      expect(campi.campiMancanti).toContain('Cantina')
      expect(campi.campiMancanti).not.toContain('superfici')
    })

    it('fa vincere l\'ultima menzione di un piano (conversazione a turni)', () => {
      const campi = normalizza(
        {
          superfici: [
            { piano: 'Piano Terra', valoreLordo: '96' },
            { piano: 'Portico', valoreLordo: '18' },
            { piano: 'Garage', valoreLordo: '30' },
            { piano: 'portico', valoreLordo: '22' },
          ],
        },
        'piano terra 96, portico 18, garage 30. correggo: portico 22',
      )

      expect(campi.superfici).toEqual([
        { piano: 'Piano Terra', valoreLordo: '96' },
        { piano: 'Garage', valoreLordo: '30' },
        { piano: 'Portico', valoreLordo: '22' },
      ])
    })

    it('scarta le voci senza un numero nel valore', () => {
      const campi = normalizza({ superfici: [{ piano: 'Portico', valoreLordo: 'da definire' }] }, 'portico da definire')

      expect(campi.superfici).toEqual([])
      expect(campi.campiMancanti).toContain('superfici')
    })
  })

  describe('spessori', () => {
    it('toglie "mm" e conserva la forma composita', () => {
      const campi = normalizza(
        { spessoreEsterno: '205 mm', spessoreCoibente: '60+40 mm', spessoreCappotto: '205-160' },
        'esterno 205 mm, coibente 60+40 mm, cappotto 205-160',
      )

      expect(campi.spessoreEsterno).toBe('205')
      expect(campi.spessoreCoibente).toBe('60+40')
      expect(campi.spessoreCappotto).toBe('205-160')
    })

    it('scarta uno spessore con un numero che il testo non contiene', () => {
      expect(normalizza({ spessoreInterno: '120' }, CRIVELLARO).spessoreInterno).toBeUndefined()
    })

    it('accetta uno spessore scritto in cm nel testo e riportato in mm dal modello', () => {
      expect(normalizza({ spessoreEsterno: '200' }, 'parete esterna da 20 cm').spessoreEsterno).toBe('200')
    })

    it('recupera nei campi giusti gli spessori finiti tra le falde', () => {
      const campi = normalizza(
        {
          falde: [
            { etichetta: 'esterno', notazione: '205 mm' },
            { etichetta: 'spessore cappotto', notazione: '140' },
          ],
        },
        CRIVELLARO,
      )

      expect(campi.spessoreEsterno).toBe('205')
      expect(campi.spessoreCappotto).toBe('140')
      expect(campi.falde).toBeUndefined()
    })

    it('recupera nei campi giusti gli spessori finiti tra le travi, senza sovrascrivere quelli già letti', () => {
      const campi = normalizza(
        {
          spessoreInterno: '160',
          travi: [
            { etichetta: 'pareti esterne', notazione: '205 mm' },
            { etichetta: 'interno', notazione: '205' },
            { etichetta: 'isolante', notazione: '200' },
          ],
        },
        `${CRIVELLARO}\nNessuna trave a vista.`,
      )

      expect(campi.spessoreEsterno).toBe('205')
      expect(campi.spessoreInterno).toBe('160')
      expect(campi.spessoreCoibente).toBe('200')
      expect(campi.travi).toBeUndefined()
    })
  })

  describe('falde e travi', () => {
    it('non tratta "copertura a falde" come una falda: è solo il tipo di copertura', () => {
      const campi = normalizza(
        { tipoCopertura: 'a falde', falde: [{ etichetta: 'copertura', notazione: 'a due falde' }] },
        'Copertura a due falde.',
      )

      expect(campi.tipoCopertura).toBe('falde')
      expect(campi.falde).toBeUndefined()
    })

    it('conserva una falda descritta con la sua notazione, copiata dal testo', () => {
      const campi = normalizza(
        { falde: [{ etichetta: 'falda', notazione: '6,1x12 x13,5' }] },
        'La copertura ha una falda con notazione 6,1x12 x13,5.',
      )

      expect(campi.falde).toEqual([{ etichetta: 'falda', notazione: '6,1x12 x13,5' }])
    })

    it('scarta una falda con misure che il testo non contiene', () => {
      const campi = normalizza({ falde: [{ etichetta: 'falda', notazione: '6x12' }] }, 'Copertura a falde.')

      expect(campi.falde).toBeUndefined()
    })

    it('scarta le travi se il testo non ne parla', () => {
      const campi = normalizza({ travi: [{ etichetta: 'colmo', notazione: '12 m' }] }, 'Copertura a falde lunga 12 m.')

      expect(campi.travi).toBeUndefined()
    })

    it('conserva una trave citata esplicitamente', () => {
      const campi = normalizza(
        { travi: [{ etichetta: 'trave di colmo', notazione: 'in lamellare da 12 m' }] },
        'una trave di colmo in lamellare da 12 m',
      )

      expect(campi.travi).toEqual([{ etichetta: 'trave di colmo', notazione: 'in lamellare da 12 m' }])
    })
  })

  describe('serramenti', () => {
    const serramento = (parziale: Grezzo): Grezzo => ({
      n: 1,
      piano: 'Piano Terra',
      tipologia: 'finestra',
      categoria: 'finestra-battente',
      b: 1.2,
      h: 1.4,
      ...parziale,
    })

    it('scarta un serramento senza altezza e rinumera quelli rimasti', () => {
      const campi = normalizza(
        {
          serramenti: [
            serramento({ tipologia: 'finestra', b: 2, h: null }),
            serramento({ tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1, h: 2.2 }),
          ],
        },
        'al piano terra una finestra di base 2 m e una porta di ingresso 1 x 2,2 m',
      )

      expect(campi.serramenti).toEqual([
        { n: 1, piano: 'Piano Terra', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1, h: 2.2 },
      ])
    })

    it('scarta un serramento con misure inventate (senza riscontro nel testo)', () => {
      const campi = normalizza({ serramenti: [serramento({ b: 1.5, h: 1.4 })] }, 'una finestra alta 1,4 m al piano terra')

      expect(campi.serramenti).toBeUndefined()
    })

    it('riconosce base e altezza scritte in cm nel testo', () => {
      const campi = normalizza(
        { serramenti: [serramento({ piano: 'piano terra', b: '1,2 m', h: 1.4 })] },
        'al piano terra una finestra 120 x 140 cm',
      )

      expect(campi.serramenti).toEqual([
        { n: 1, piano: 'Piano Terra', tipologia: 'finestra', categoria: 'finestra-battente', b: 1.2, h: 1.4 },
      ])
    })

    it('fa prevalere la categoria del modello sulla tipologia', () => {
      const campi = normalizza(
        { serramenti: [serramento({ tipologia: 'portafinestra', categoria: 'alzante-scorrevole', b: 2.4, h: 2.3 })] },
        'la portafinestra del piano terra 2,4 x 2,3 la facciamo alzante scorrevole',
      )

      expect(campi.serramenti?.[0].categoria).toBe('alzante-scorrevole')
      expect(campi.serramenti?.[0].tipologia).toBe('portafinestra')
    })

    it('ripiega sulla tipologia quando la categoria del modello non è ammessa', () => {
      const testo = 'piano terra: porta di ingresso 1 x 2,2; vetrata fissa 2 x 2,2; alzante scorrevole 3 x 2,2'
      const campi = normalizza(
        {
          serramenti: [
            serramento({ tipologia: 'porta di ingresso', categoria: 'porta', b: 1, h: 2.2 }),
            serramento({ tipologia: 'vetrata fissa', categoria: null, b: 2, h: 2.2 }),
            serramento({ tipologia: 'alzante scorrevole', categoria: 'scorrevole', b: 3, h: 2.2 }),
          ],
        },
        testo,
      )

      expect(campi.serramenti?.map((s) => s.categoria)).toEqual(['portoncino', 'fisso-vetrata', 'alzante-scorrevole'])
    })

    it('scarta un serramento se né categoria né tipologia portano a una categoria ammessa', () => {
      const campi = normalizza(
        { serramenti: [serramento({ tipologia: 'oblò', categoria: 'oblo-rotondo', b: 0.5, h: 0.5 })] },
        'un oblò di 0,5 x 0,5 al piano terra',
      )

      expect(campi.serramenti).toBeUndefined()
    })
  })

  describe('pareti', () => {
    it('conserva una parete completa con tipo esteso ("esterna") e spessore in mm scritto in cm', () => {
      const campi = normalizza(
        { pareti: [{ n: 1, tipo: 'esterna', b: 9.4, h: 2.8, spessore: 200 }] },
        'parete esterna di base 9,4 m, altezza 2,8 m, spessore 20 cm',
      )

      expect(campi.pareti).toEqual([{ n: 1, tipo: 'E', b: 9.4, h: 2.8, spessore: 200 }])
    })

    it('scarta una parete senza spessore', () => {
      const campi = normalizza(
        { pareti: [{ n: 1, tipo: 'I', b: 4, h: 2.6, spessore: null }] },
        'parete interna di base 4 m e altezza 2,6 m',
      )

      expect(campi.pareti).toBeUndefined()
    })
  })

  describe('scelte chiuse', () => {
    it('riconosce copertura, finitura e pacchetto scritti a parole', () => {
      const campi = normalizza(
        { tipoCopertura: 'tetto piano', finituraEsterna: 'rivestimento in legno', pacchetto: 'Chiavi in mano' },
        'tetto piano, rivestimento in legno, chiavi in mano',
      )

      expect(campi.tipoCopertura).toBe('piano')
      expect(campi.finituraEsterna).toBe('rivestimento')
      expect(campi.pacchetto).toBe('chiavi in mano')
    })

    it('lascia vuota una scelta non riconosciuta e la segnala mancante', () => {
      const campi = normalizza({ tipoCopertura: 'a botte' }, 'copertura a botte')

      expect(campi.tipoCopertura).toBeUndefined()
      expect(campi.campiMancanti).toContain('tipoCopertura')
    })
  })
})

describe('parsaJsonTollerante', () => {
  it('legge un JSON puro', () => {
    expect(parsaJsonTollerante('{"a":1}')).toEqual({ a: 1 })
  })

  it('tollera le recinzioni markdown', () => {
    expect(parsaJsonTollerante('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('tollera testo attorno all\'oggetto', () => {
    expect(parsaJsonTollerante('Ecco il JSON: {"a":{"b":2}} spero vada bene')).toEqual({ a: { b: 2 } })
  })

  it('lancia un errore con l\'inizio della risposta se non trova un oggetto', () => {
    expect(() => parsaJsonTollerante('non è json')).toThrow(/risposta non JSON: non è json/)
  })
})

describe('controllaForma', () => {
  it('accetta la forma chiesta dal prompt', () => {
    expect(controllaForma(VUOTA)).toBe(VUOTA)
  })

  it('scarta la chiave radice di un oggetto avvolto', () => {
    expect(controllaForma({ preventivo: VUOTA })).toBe(VUOTA)
  })

  it('rifiuta ciò che non è un oggetto', () => {
    expect(() => controllaForma([VUOTA])).toThrow(/non è un oggetto JSON/)
    expect(() => controllaForma(null)).toThrow(/non è un oggetto JSON/)
  })

  it('rifiuta un cliente che non è un oggetto', () => {
    expect(() => controllaForma({ ...VUOTA, cliente: 'Crivellaro Mariano' })).toThrow(/"cliente" deve essere un oggetto/)
  })

  it('rifiuta superfici che non sono una lista', () => {
    expect(() => controllaForma({ ...VUOTA, superfici: { 'Piano Terra': '134' } })).toThrow(/"superfici" deve essere una lista/)
  })

  it('tollera fino a tre chiavi assenti, oltre rifiuta elencandole', () => {
    const senza = (...chiavi: string[]): Grezzo =>
      Object.fromEntries(Object.entries(VUOTA).filter(([chiave]) => !chiavi.includes(chiave)))

    const treAssenti = senza('pareti', 'falde', 'travi')
    expect(controllaForma(treAssenti)).toBe(treAssenti)
    expect(() => controllaForma(senza('pareti', 'falde', 'travi', 'serramenti'))).toThrow(
      'mancano le chiavi pareti, falde, travi, serramenti',
    )
  })
})

describe('verificaNomeCliente', () => {
  it('accetta un nome che compare nel testo, anche solo in parte', () => {
    expect(() => verificaNomeCliente({ cliente: { nome: 'Crivellaro Mariano' } }, 'casa per il sig. Crivellaro')).not.toThrow()
  })

  it('accetta un nome assente: sarà segnalato tra i mancanti', () => {
    expect(() => verificaNomeCliente({ cliente: { nome: null } }, 'testo senza nomi')).not.toThrow()
  })

  it('rifiuta un nome che non compare affatto nel testo (il modello ha risposto ad altro)', () => {
    expect(() => verificaNomeCliente({ cliente: { nome: 'Zanella Giorgia' } }, 'casa per Crivellaro a Trissino')).toThrow(
      'il cliente "Zanella Giorgia" non compare nel testo',
    )
  })
})
