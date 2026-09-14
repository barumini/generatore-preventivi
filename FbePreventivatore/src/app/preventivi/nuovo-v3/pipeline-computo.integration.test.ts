import { describe, expect, it } from 'vitest'
import type { FrammentoTesto } from '@/domain/computo/frammenti'
import { estraiComputo } from '@/domain/computo/estrai-voci'
import { eseguiConteggio } from '@/domain/computo/conteggio'
import { eseguiCalcolo } from '@/domain/calcolo'
import { CATALOGO_VOCI } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import crivellaroFixture from '@/domain/computo/fixtures/crivellaro.json'
import dacroceFixture from '@/domain/computo/fixtures/dacroce.json'
import { mappaConteggioAOverride, numeroPianiAbitativiDalComputo } from './mappa-conteggio'

describe('pipeline computo -> conteggio -> override -> Listino (golden case Crivellaro)', () => {
  it('produce il Listino atteso a partire dal computo Crivellaro reale', () => {
    const computo = estraiComputo(crivellaroFixture as FrammentoTesto[])
    const esitoConteggio = eseguiConteggio(computo, {})

    const configurazione = {
      livelli: { struttura: 'completo' as const, involucro: 'completo' as const, finiture: 'impoverito' as const },
      numeroPianiAbitativi: 1,
      superficieGarage: 0,
      chiaviInManoNelTotale: false,
    }

    const { overrides, vociScartate, vociEscluseDallaConfigurazione } = mappaConteggioAOverride(
      esitoConteggio.voci,
      {},
      configurazione,
    )

    expect(vociScartate).toEqual(['copertura-piana', 'veletta-perimetrale'])
    expect(vociEscluseDallaConfigurazione).toEqual(['solaio-interpiano'])
    expect(overrides['pareti-mhm']).toBe(100645.84)
    expect(overrides['copertura-falda']).toBe(58849.06)

    const risultato = eseguiCalcolo({
      catalogo: CATALOGO_VOCI,
      configurazione,
      listino: LISTINO_2026,
      geometria: {
        superficiLordeTotale: 0,
        superficieSedime: 0,
        superficieGarage: 0,
        perimetro: 0,
        serramenti: { areaLordaTotale: 0, numero: 0 },
      },
      overrides,
      sconti: [],
      sicurezza: { costoDichiarato: 0, valorizzata: 0 },
      arrotondamento: 0,
    })

    expect(risultato.listinoTotale).toBe(236960.99)
  })
})

describe('pipeline computo -> conteggio -> override -> Listino (golden case Da Croce, edificio bipiano)', () => {
  it("include solaio-interpiano perché il computo stesso lo segnala multipiano (numeroPianiAbitativiDalComputo), niente step Geometria", () => {
    const computo = estraiComputo(dacroceFixture as FrammentoTesto[])
    const esitoConteggio = eseguiConteggio(computo, {})

    // A differenza del test Crivellaro sopra, numeroPianiAbitativi non è digitato a mano:
    // si deriva dallo stesso esitoConteggio che alimenta mappaConteggioAOverride — Da Croce
    // è un edificio Piano Terra + Piano Primo reale (vedi Offerta MHM rev.02_Dacroce Dalila
    // riscontro.pdf, pag. 4: "CARATTERISTICHE FABBRICATO – Totale Lordi 138 + 62 = 200 mq"),
    // e il computo lo rivela da solo tramite la categoria SOLAIO valorizzata.
    const configurazione = {
      livelli: { struttura: 'completo' as const, involucro: 'completo' as const, finiture: 'impoverito' as const },
      numeroPianiAbitativi: numeroPianiAbitativiDalComputo(esitoConteggio.voci),
      superficieGarage: 0,
      chiaviInManoNelTotale: false,
    }
    expect(configurazione.numeroPianiAbitativi).toBe(2)

    const { overrides, vociScartate, vociEscluseDallaConfigurazione } = mappaConteggioAOverride(
      esitoConteggio.voci,
      {},
      configurazione,
    )

    expect(vociScartate).toEqual(['copertura-piana', 'veletta-perimetrale'])
    expect(vociEscluseDallaConfigurazione).toEqual([])
    expect(overrides['solaio-interpiano']).toBe(15240.96)
    expect(overrides['pareti-mhm']).toBe(127543.28)

    const risultato = eseguiCalcolo({
      catalogo: CATALOGO_VOCI,
      configurazione,
      listino: LISTINO_2026,
      geometria: {
        superficiLordeTotale: 0,
        superficieSedime: 0,
        superficieGarage: 0,
        perimetro: 0,
        serramenti: { areaLordaTotale: 0, numero: 0 },
      },
      overrides,
      sconti: [],
      sicurezza: { costoDichiarato: 0, valorizzata: 0 },
      arrotondamento: 0,
    })

    // Con solaio-interpiano incluso, la somma di tutte le voci del conteggio atterra
    // esattamente sul target di riconciliazione (esitoConteggio.target, non testato qui
    // per nome ma già verificato in src/domain/computo/conteggio.test.ts).
    expect(risultato.listinoTotale).toBe(300343.58)
  })
})
