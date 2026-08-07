// src/app/preventivi/nuovo/stato-form.ts
import { totaleSuperficiLorde, superficieGarage, superficieSedime, numeroPianiAbitativi, totaliSerramenti, type SuperficiePiano, type Serramento } from '@/domain/geometria'
import { CATALOGO_VOCI, type LivelloModulo, type Modulo } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import type { InputCalcolo, ParametriSconto, Sicurezza } from '@/domain/calcolo'

export interface CaratteristicheCostruttive {
  // 'piano' è solo descrittivo in questo giro: nel catalogo (src/domain/voci.ts) non esiste
  // nessuna voce alternativa a copertura-falda (niente tetto-piano/veletta-copertura-piana) —
  // selezionare 'piano' NON cambia i prezzi.
  copertura: 'falde' | 'piano'
  manto: string
  finituraEsterna: 'intonaco' | 'rivestimento'
  tetto: string
}

export type Pacchetto = 'Grezzo' | 'Grezzo avanzato' | 'Chiavi in mano'

// Tabella §5 dello spec principale. Dipende solo da involucro/finiture: la tabella non fa
// mai variare struttura tra i tre pacchetti nominati, e chiaviInManoNelTotale NON entra qui
// (decide solo se opere-chiavi-in-mano è sommata nel totale, non il pacchetto mostrato —
// verificato contro il golden case Crivellaro, che è Grezzo avanzato nonostante il flag true).
export function pacchettoDaLivelli(livelli: Record<Modulo, LivelloModulo>): Pacchetto {
  if (livelli.finiture === 'completo') return 'Chiavi in mano'
  if (livelli.involucro === 'completo') return 'Grezzo avanzato'
  return 'Grezzo'
}

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
  sicurezza: Sicurezza
  caratteristiche: CaratteristicheCostruttive // NUOVO
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
    sicurezza: stato.sicurezza,
    arrotondamento: { risolviPerTotale: stato.totaleTarget },
  }
}
