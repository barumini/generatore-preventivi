import { describe, expect, it } from 'vitest'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import type { CampiEstratti } from '@/ai/estrazione'
import { superficieGarage, superficieSedime } from '@/domain/geometria'
import { OGGETTO_STANDARD } from './stato-form'

describe('statoFormDaCampiEstratti', () => {
  it('mappa i campi estratti nella forma attesa da StatoForm', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      superfici: [{ piano: 'Piano Terra', valoreLordo: '134' }],
      tipoCopertura: 'falde',
      finituraEsterna: 'intonaco',
      pacchetto: 'grezzo avanzato',
      campiMancanti: ['progettista'],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.cliente).toEqual({ nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' })
    expect(parziale.protocollo).toBe('2026059')
    expect(parziale.superfici).toEqual([{ piano: 'Piano Terra', valoreLordo: '134' }])
    expect(parziale.caratteristiche).toMatchObject({ copertura: 'falde', finituraEsterna: 'intonaco' })
    expect(parziale.livelli).toEqual({ struttura: 'completo', involucro: 'completo', finiture: 'impoverito' })
  })

  it('mappa tipoCopertura, finituraEsterna e pacchetto nei campi da cui il motore prezzi li legge davvero', () => {
    // Bug reale trovato testando il wizard con LM Studio: il modello estraeva questi tre
    // campi correttamente (non finivano in campiMancanti) ma il form restava sui default,
    // perché prima non venivano proprio mappati — con dati errati non segnalati all'operatore.
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi' },
      superfici: [],
      tipoCopertura: 'piano',
      finituraEsterna: 'rivestimento',
      pacchetto: 'chiavi in mano',
      campiMancanti: [],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.caratteristiche).toMatchObject({ copertura: 'piano', finituraEsterna: 'rivestimento' })
    expect(parziale.livelli).toEqual({ struttura: 'completo', involucro: 'completo', finiture: 'completo' })
  })

  it('senza tipoCopertura/finituraEsterna/pacchetto estratti, usa i default e lascia livelli intoccato', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Solo Nome' },
      superfici: [],
      campiMancanti: ['tipoCopertura', 'finituraEsterna', 'pacchetto'],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.caratteristiche).toMatchObject({ copertura: 'falde', finituraEsterna: 'intonaco' })
    expect(parziale.livelli).toBeUndefined()
  })

  it("non imposta campi non presenti nell'estrazione, lasciandoli da compilare nel form", () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Solo Nome' },
      superfici: [],
      campiMancanti: ['comune', 'protocollo'],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.protocollo).toBeUndefined()
  })

  it('normalizza i nomi piano estratti nella forma canonica che il dominio confronta', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Test' },
      superfici: [
        { piano: 'Piano terra', valoreLordo: '134' },
        { piano: 'garage', valoreLordo: '41' },
        { piano: '  Portico ', valoreLordo: '13+14' },
      ],
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).superfici).toEqual([
      { piano: 'Piano Terra', valoreLordo: '134' },
      { piano: 'Garage', valoreLordo: '41' },
      { piano: 'Portico', valoreLordo: '13+14' },
    ])
  })

  it('lascia invariato un piano non riconosciuto, così l\'operatore lo vede e lo corregge', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Test' },
      superfici: [{ piano: 'Mansarda', valoreLordo: '30' }],
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).superfici).toEqual([{ piano: 'Mansarda', valoreLordo: '30' }])
  })

  it('un piano normalizzato entra correttamente nel calcolo, uno grezzo no', () => {
    const grezzi: CampiEstratti = {
      cliente: { nome: 'Test' },
      superfici: [
        { piano: 'piano terra', valoreLordo: '134' },
        { piano: 'box auto', valoreLordo: '41' },
      ],
      campiMancanti: [],
    }

    const superfici = statoFormDaCampiEstratti(grezzi).superfici!
    // 'piano terra' recuperato → il sedime alimenta il driver della copertura;
    // 'box auto' non è un nome canonico → resta fuori, e resta visibile nel form.
    expect(superficieSedime(superfici)).toBe(134)
    expect(superficieGarage(superfici)).toBe(0)
    expect(superfici[1].piano).toBe('box auto')
  })

  it('mappa progettista quando presente', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi' },
      superfici: [],
      progettista: 'Mario Rossi',
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).progettista).toBe('Mario Rossi')
  })

  it('non imposta progettista quando assente, lasciandolo da compilare nel form', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: ['progettista'] }

    expect(statoFormDaCampiEstratti(campi).progettista).toBeUndefined()
  })

  it('deduce luogo dal comune del cliente quando non specificato esplicitamente', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi', comune: 'Trissino' },
      superfici: [],
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).luogo).toBe('Trissino')
  })

  it('usa il luogo esplicito quando presente, invece del comune', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi', comune: 'Trissino' },
      superfici: [],
      luogo: 'Bassano del Grappa',
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).luogo).toBe('Bassano del Grappa')
  })

  it('senza comune né luogo, luogo è stringa vuota', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] }

    expect(statoFormDaCampiEstratti(campi).luogo).toBe('')
  })

  it('imposta sempre oggetto alla frase standard, indipendentemente dall\'input', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] }

    expect(statoFormDaCampiEstratti(campi).oggetto).toBe(OGGETTO_STANDARD)
  })

  it('mappa gli spessori estratti quando presenti', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi' },
      superfici: [],
      spessoreEsterno: '205-160',
      spessoreCappotto: '60+40',
      campiMancanti: [],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.caratteristiche).toMatchObject({ spessoreEsterno: '205-160', spessoreCappotto: '60+40' })
  })

  it('mappa pareti, falde e travi quando presenti', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi' },
      superfici: [],
      pareti: [{ n: 1, tipo: 'E', b: 12.5, h: 2.7, spessore: 20 }],
      falde: [{ etichetta: 'Una falda', notazione: '5,8x16,5 x17,1' }],
      travi: [{ etichetta: 'Colmo', notazione: '16,5x0,2x0,32' }],
      campiMancanti: [],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.pareti).toEqual([{ n: 1, tipo: 'E', b: 12.5, h: 2.7, spessore: 20 }])
    expect(parziale.falde).toEqual([{ etichetta: 'Una falda', notazione: '5,8x16,5 x17,1' }])
    expect(parziale.travi).toEqual([{ etichetta: 'Colmo', notazione: '16,5x0,2x0,32' }])
  })

  it('non imposta pareti/falde/travi quando assenti, lasciando intoccati quelli già nel form', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.pareti).toBeUndefined()
    expect(parziale.falde).toBeUndefined()
    expect(parziale.travi).toBeUndefined()
  })

  it('senza spessori estratti, usa i default vuoti', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.caratteristiche).toMatchObject({
      spessoreEsterno: '',
      spessoreInterno: '',
      spessoreCoibente: '',
      spessoreCappotto: '',
    })
  })
})
