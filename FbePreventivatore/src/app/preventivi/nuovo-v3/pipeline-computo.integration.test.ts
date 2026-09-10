import { describe, expect, it } from 'vitest'
import type { FrammentoTesto } from '@/domain/computo/frammenti'
import { estraiComputo } from '@/domain/computo/estrai-voci'
import { eseguiConteggio } from '@/domain/computo/conteggio'
import { eseguiCalcolo } from '@/domain/calcolo'
import { CATALOGO_VOCI } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import crivellaroFixture from '@/domain/computo/fixtures/crivellaro.json'
import { mappaConteggioAOverride } from './mappa-conteggio'

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
