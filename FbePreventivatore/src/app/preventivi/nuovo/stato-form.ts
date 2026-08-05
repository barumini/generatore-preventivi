// src/app/preventivi/nuovo/stato-form.ts
import { totaleSuperficiLorde, superficieGarage, superficieSedime, numeroPianiAbitativi, totaliSerramenti, type SuperficiePiano, type Serramento } from '@/domain/geometria'
import { CATALOGO_VOCI, type LivelloModulo, type Modulo } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import type { InputCalcolo, ParametriSconto } from '@/domain/calcolo'

export interface StatoForm {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  superfici: SuperficiePiano[]
  totaleLordoManuale?: number // sovrascrive totaleSuperficiLorde(superfici) — spec §3.9, non sempre una somma piena (es. Zapparoni)
  serramenti: Serramento[]
  perimetro: number
  livelli: Record<Modulo, LivelloModulo>
  chiaviInManoNelTotale: boolean
  sconti: ParametriSconto[]
  overrides: Record<string, number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'>
  totaleTarget: number
}

export function inputCalcoloDaStato(stato: StatoForm): InputCalcolo {
  const { areaLordaTotale, numero } = totaliSerramenti(stato.serramenti)

  return {
    catalogo: CATALOGO_VOCI,
    configurazione: {
      livelli: stato.livelli,
      numeroPianiAbitativi: numeroPianiAbitativi(stato.superfici),
      superficieGarage: superficieGarage(stato.superfici),
      chiaviInManoNelTotale: stato.chiaviInManoNelTotale,
    },
    listino: LISTINO_2026,
    geometria: {
      superficiLordeTotale: stato.totaleLordoManuale ?? totaleSuperficiLorde(stato.superfici),
      superficieSedime: superficieSedime(stato.superfici),
      superficieGarage: superficieGarage(stato.superfici),
      perimetro: stato.perimetro,
      serramenti: { areaLordaTotale, numero },
    },
    overrides: stato.overrides,
    sconti: stato.sconti,
    sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
    arrotondamento: { risolviPerTotale: stato.totaleTarget },
  }
}
