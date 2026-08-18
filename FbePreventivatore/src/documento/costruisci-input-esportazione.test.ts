// src/documento/costruisci-input-esportazione.test.ts
import { describe, expect, it } from 'vitest'
import { costruisciInputEsportazione } from './costruisci-input-esportazione'
import { generaAbacoPerCategoria } from '@/ai/abaco'
import { eseguiCalcolo } from '@/domain/calcolo'
import { inputCalcoloDaStato, type StatoForm } from '@/app/preventivi/nuovo/stato-form'
import type { CondizioniForm } from './condizioni-default'
import path from 'node:path'

const CONDIZIONI_CRIVELLARO: CondizioniForm = {
  consegna: 'da pattuire',
  caparra: 30000,
  validita: '31.08.2026',
  sal: [
    { percentuale: 0.2, descrizione: 'Acconto al contratto' },
    { percentuale: 0.1, descrizione: 'Informativa di cantiere' },
    { percentuale: 0.4, descrizione: 'Inizio montaggio' },
    { percentuale: 0.1, descrizione: 'Al tetto primo tavolato (escluso tegole)' },
    { percentuale: 0.1, descrizione: 'Cappotto esterno grezzo (escluso intonachino)' },
    { percentuale: 0.05, descrizione: 'Inizio posa Cartongesso' },
    { percentuale: 0.05, descrizione: 'Fine lavori' },
  ],
  optional: [
    { descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici', importo: 5000, praticaGenioCivile: true },
  ],
  esclusioni: [{ descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' }],
}

// Golden case Crivellaro (CLAUDE.md), costruito da uno StatoForm completo invece che da un
// InputEsportazione letterale come in export-docx.test.ts. Un solo serramento (non gli 11 reali
// di geometria.test.ts): tutti i prezzi vengono da `overrides` — la geometria dei serramenti
// non entra in nessun totale (bypassata dagli override, verificato leggendo domain/calcolo.ts) —
// e un solo portoncino rende l'abaco atteso banale da verificare.
const STATO_CRIVELLARO: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-05',
  luogo: 'Castelgomberto',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [{ n: 1, piano: 'Piano Terra', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 }],
  perimetro: 60,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  chiaviInManoNelTotale: true,
  overrides: {
    'pareti-mhm': 96100, 'trave-larice': 5800, 'copertura-falda': 63600, cappotto: 20300,
    'cartongesso-q2': 15500, 'assistenza-cartongessisti': 2200, 'infissi-pvc': 19300,
    monoblocchi: 10200, 'progettazione-esecutiva': 4000, 'opere-chiavi-in-mano': 89100, garage: 20000,
  },
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }, { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' }],
  totaleTarget: 300000,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
  },
  condizioni: CONDIZIONI_CRIVELLARO,
}

describe('costruisciInputEsportazione — golden case Crivellaro', () => {
  it('mappa cliente/protocollo/revisione/dataOfferta/annoListino', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.cliente).toEqual({ nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' })
    expect(input.protocollo).toBe('2026059')
    expect(input.revisione).toBe('00') // prima revisione salvata, numero: 1 -> '00'
    expect(input.dataOfferta).toBe('Castelgomberto, 5 agosto 2026')
    expect(input.annoListino).toBe(2026)
  })

  it('la revisione si formatta come numero-1 su due cifre', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 3, protocollo: '2026059' })
    expect(input.revisione).toBe('02')
  })

  it('mappa le caratteristiche, incluso il pacchetto derivato dai livelli', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.caratteristiche).toEqual({
      tetto: 'Tetto con travi e perline in abete',
      mantoCopertura: 'Tegole in cemento',
      finituraEsterna: 'Intonaco',
      pacchettoConsegna: 'Grezzo avanzato',
    })
  })

  it('ricalcola totaleLorda al volo (rete di sicurezza) quando totaleLordoTesto non è mai stato toccato', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.superfici).toEqual({
      totaleLorda: '134+13+14= 161',
      pianoTerra: '134',
      pianoPrimo: '',
      sottotetto: '',
      portico: '13+14',
      terrazzo: '',
      garage: '41',
    })
  })

  it('usa totaleLordoTesto verbatim quando è stato valorizzato, invece di ricalcolarlo', () => {
    const statoConTesto: StatoForm = { ...STATO_CRIVELLARO, totaleLordoTesto: '134+13+14 (vedi planimetria)= 161' }
    const input = costruisciInputEsportazione(statoConTesto, { numero: 1, protocollo: '2026059' })
    expect(input.superfici.totaleLorda).toBe('134+13+14 (vedi planimetria)= 161')
  })

  it('mappa condizioni: SAL divisi slice(0,3)/slice(3), optional/esclusioni con lettera di posizione', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.condizioni.consegna).toBe('da pattuire')
    expect(input.condizioni.caparra).toBe(30000)
    expect(input.condizioni.validita).toBe('31.08.2026')
    expect(input.condizioni.salPrimi).toEqual([
      { percentuale: 0.2, descrizione: 'Acconto al contratto' },
      { percentuale: 0.1, descrizione: 'Informativa di cantiere' },
      { percentuale: 0.4, descrizione: 'Inizio montaggio' },
    ])
    expect(input.condizioni.salSuccessivi).toEqual([
      { percentuale: 0.1, descrizione: 'Al tetto primo tavolato (escluso tegole)' },
      { percentuale: 0.1, descrizione: 'Cappotto esterno grezzo (escluso intonachino)' },
      { percentuale: 0.05, descrizione: 'Inizio posa Cartongesso' },
      { percentuale: 0.05, descrizione: 'Fine lavori' },
    ])
    expect(input.condizioni.optional).toEqual([
      { id: 'pratica-genio-civile', lettera: 'A)', descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici', importo: 5000 },
    ])
    // esclusioni non ha il concetto di praticaGenioCivile: l'id generato è sempre '' (non letto
    // da nessun tag del master per le esclusioni, a differenza di optional).
    expect(input.condizioni.esclusioni).toEqual([
      { id: '', lettera: 'a)', descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' },
    ])
  })

  it('genera lettere di posizione multiple correttamente (A, B, C / a, b, c)', () => {
    const statoConPiuVoci: StatoForm = {
      ...STATO_CRIVELLARO,
      condizioni: {
        ...CONDIZIONI_CRIVELLARO,
        optional: [
          { descrizione: 'Prima', importo: 100 },
          { descrizione: 'Seconda', importo: 200, praticaGenioCivile: true },
          { descrizione: 'Terza', importo: 300 },
        ],
        esclusioni: [
          { descrizione: 'Prima', importo: 10 },
          { descrizione: 'Seconda', importo: 20 },
        ],
      },
    }
    const input = costruisciInputEsportazione(statoConPiuVoci, { numero: 1, protocollo: '2026059' })
    expect(input.condizioni.optional.map((v) => v.lettera)).toEqual(['A)', 'B)', 'C)'])
    expect(input.condizioni.optional.find((v) => v.descrizione === 'Seconda')?.id).toBe('pratica-genio-civile')
    expect(input.condizioni.optional.find((v) => v.descrizione === 'Prima')?.id).toBe('')
    expect(input.condizioni.esclusioni.map((v) => v.lettera)).toEqual(['a)', 'b)'])
  })

  it('mappa abaco chiamando generaAbacoPerCategoria sui serramenti dello stato', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.abaco).toEqual(generaAbacoPerCategoria(STATO_CRIVELLARO.serramenti))
  })

  it('risolve percorsoMaster nel repository, nessuna configurazione esterna', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.percorsoMaster).toBe(path.join(process.cwd(), 'template', 'Offerta MHM master.docx'))
  })

  it('il risultato riproduce i totali del golden case CLAUDE.md — 237 000 di listino, 190 900 di parziale, 300 000 di totale', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.risultato).toEqual(eseguiCalcolo(inputCalcoloDaStato(STATO_CRIVELLARO)))
    expect(input.risultato.listinoTotale).toBe(237000)
    expect(input.risultato.sconti.map((s) => s.importoCalcolato)).toEqual([23700, 21330])
    expect(input.risultato.parziale).toBe(190900)
    expect(input.risultato.totaleNetto).toBe(300000)
  })

  it('non passa consentiPlaceholderNonRisolti — il golden case Crivellaro ha placeholder di spessore non interpolati e deve bloccarsi in costruisciBufferOfferta, non essere silenziato qui', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.consentiPlaceholderNonRisolti).toBeUndefined()
  })
})
