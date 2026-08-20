// src/app/preventivi/nuovo/stato-form.ts
import { totaleSuperficiLorde, superficieGarage, superficieSedime, numeroPianiAbitativi, totaliSerramenti, type SuperficiePiano, type Serramento } from '@/domain/geometria'
import { CATALOGO_VOCI, type LivelloModulo, type Modulo } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import type { InputCalcolo, ParametriSconto, Sicurezza } from '@/domain/calcolo'
import type { CondizioniForm } from '@/documento/condizioni-default'
import type { Parete, VoceGeometricaLibera } from '@/domain/importazione-excel'

export interface CaratteristicheCostruttive {
  // 'piano' è solo descrittivo in questo giro: nel catalogo (src/domain/voci.ts) non esiste
  // nessuna voce alternativa a copertura-falda (niente tetto-piano/veletta-copertura-piana) —
  // selezionare 'piano' NON cambia i prezzi.
  copertura: 'falde' | 'piano'
  manto: string
  finituraEsterna: 'intonaco' | 'rivestimento'
  tetto: string
  // Spessori delle stratigrafie citati nelle descrizioni voce (src/domain/voci.ts, id
  // pareti-mhm/copertura-falda/cappotto). Stringa libera, non un numero: nei documenti reali
  // sono spesso compositi ("60+40", "205-160", "160 (80+60+20)" — spec §9.3 del design
  // principale). Vuoto di default: eseguiCalcolo lascia il placeholder {{...}} intatto finché
  // non sono compilati, e il guardrail export blocca finché resta un placeholder residuo.
  spessoreEsterno: string
  spessoreInterno: string
  spessoreCoibente: string
  spessoreCappotto: string
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

// Inversa di pacchettoDaLivelli, stessa tabella §5: usata per precompilare i livelli
// quando il pacchetto arriva da testo libero (estrazione AI) invece che da UI.
export function livelliDaPacchetto(pacchetto: 'grezzo' | 'grezzo avanzato' | 'chiavi in mano'): Record<Modulo, LivelloModulo> {
  switch (pacchetto) {
    case 'chiavi in mano':
      return { struttura: 'completo', involucro: 'completo', finiture: 'completo' }
    case 'grezzo avanzato':
      return { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' }
    case 'grezzo':
      return { struttura: 'completo', involucro: 'impoverito', finiture: 'escluso' }
  }
}

export const CARATTERISTICHE_DEFAULT: CaratteristicheCostruttive = {
  copertura: 'falde',
  manto: 'Tegole in cemento',
  finituraEsterna: 'intonaco',
  tetto: 'Tetto con travi e perline in abete',
  spessoreEsterno: '',
  spessoreInterno: '',
  spessoreCoibente: '',
  spessoreCappotto: '',
}

export const OGGETTO_STANDARD = 'Fornitura e posa in opera di casa in legno MHM'

export interface StatoForm {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  oggetto: string // NUOVO — Preventivo.oggetto
  progettista: string // NUOVO — Preventivo.progettista (opzionale nello schema, stringa vuota se non compilato)
  data: string // NUOVO — Revisione.data, formato ISO 'YYYY-MM-DD'
  luogo: string // NUOVO — Revisione.luogo
  superfici: SuperficiePiano[]
  totaleLordoManuale?: number // sovrascrive totaleSuperficiLorde(superfici) — spec §3.9, non sempre una somma piena (es. Zapparoni)
  totaleLordoTesto?: string // NUOVO — testo libero per InputEsportazione.superfici.totaleLorda (spec §2)
  serramenti: Serramento[]
  perimetro: number
  // Dati grezzi dell'import Excel (v2, "Conteggi pulito.xlsx"): non entrano in
  // inputCalcoloDaStato, il motore di calcolo non li usa come driver di prezzo (nessuna
  // voce del catalogo è priced su pareti/falde/travi singole). Restano informativi,
  // mostrati in sola lettura nel wizard — coerente con la scelta di conservare la forma
  // scritta invece di interpretarla (stessa logica delle superfici a stringa libera).
  pareti?: Parete[]
  falde?: VoceGeometricaLibera[]
  travi?: VoceGeometricaLibera[]
  livelli: Record<Modulo, LivelloModulo>
  chiaviInManoNelTotale: boolean
  sconti: ParametriSconto[]
  overrides: Record<string, number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'>
  totaleTarget: number
  sicurezza: Sicurezza
  caratteristiche: CaratteristicheCostruttive // NUOVO
  condizioni: CondizioniForm // NUOVO — spec §1/§3
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
    spessori: {
      spessoreEsterno: stato.caratteristiche.spessoreEsterno,
      spessoreInterno: stato.caratteristiche.spessoreInterno,
      spessoreCoibente: stato.caratteristiche.spessoreCoibente,
      spessoreCappotto: stato.caratteristiche.spessoreCappotto,
    },
  }
}
