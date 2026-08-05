export interface ParametriSconto {
  percentuale: number
  causale: string
}

export interface Sconto extends ParametriSconto {
  ordine: number
  importoCalcolato: number
}

function arrotondaCentesimi(valore: number): number {
  return Math.round(valore * 100) / 100
}

export function applicaScontiACascata(base: number, sconti: ParametriSconto[]): Sconto[] {
  let residuo = base
  return sconti.map((sconto, indice) => {
    const importoCalcolato = arrotondaCentesimi(residuo * sconto.percentuale)
    residuo -= importoCalcolato
    return { ordine: indice + 1, percentuale: sconto.percentuale, causale: sconto.causale, importoCalcolato }
  })
}

export function calcolaParziale(listinoTotale: number, sconti: Sconto[], arrotondamento: number): number {
  const totaleSconti = sconti.reduce((somma, s) => somma + s.importoCalcolato, 0)
  return arrondaParziale(listinoTotale, totaleSconti, arrotondamento)
}

function arrondaParziale(listinoTotale: number, totaleSconti: number, arrotondamento: number): number {
  return arrotondaCentesimi(listinoTotale - totaleSconti - arrotondamento)
}

/**
 * Problema inverso: dato il totale che si vuole ottenere (es. una cifra tonda),
 * risolve quale Arrotondamento manuale serve nella riga del preventivo.
 */
export function risolviArrotondamento(
  listinoTotale: number,
  parametriSconti: ParametriSconto[],
  totaleTarget: number,
  sommaVociPostSconto: number,
): number {
  const sconti = applicaScontiACascata(listinoTotale, parametriSconti)
  const totaleSconti = sconti.reduce((somma, s) => somma + s.importoCalcolato, 0)
  const parzialeSenzaArrotondamento = arrotondaCentesimi(listinoTotale - totaleSconti)
  const parzialeRichiesto = arrotondaCentesimi(totaleTarget - sommaVociPostSconto)
  return arrotondaCentesimi(parzialeSenzaArrotondamento - parzialeRichiesto)
}

export function sogliaArrotondamentoSuperata(arrotondamento: number, listinoTotale: number, sogliaPercentuale = 0.02): boolean {
  return Math.abs(arrotondamento) / listinoTotale > sogliaPercentuale
}

import { vociIncluse, numeraVoci, type VoceCatalogo, type ConfigurazioneVoci } from './voci'
import { driverPer, proponiValore, type ListinoAnno, type InputGeometricoListino } from './listino'

export interface VoceValorizzata {
  numero: string
  id: string
  descrizione: string
  gruppo: 'grezzo' | 'post_sconto'
  importo: number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'
  provenienza: 'proposto' | 'manuale' | 'ripartito'
}

export interface Sicurezza {
  costoDichiarato: number
  valorizzata: number | 'OMAGGIO'
}

export interface InputCalcolo {
  catalogo: VoceCatalogo[]
  configurazione: ConfigurazioneVoci
  listino: ListinoAnno
  geometria: InputGeometricoListino
  overrides: Record<string, number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'>
  sconti: ParametriSconto[]
  sicurezza: Sicurezza
  arrotondamento: number | { risolviPerTotale: number }
}

export interface RisultatoCalcolo {
  vociValorizzate: VoceValorizzata[]
  listinoTotale: number
  sconti: Sconto[]
  arrotondamento: number
  parziale: number
  sicurezza: Sicurezza
  totaleNetto: number
}

function sommaNumerica(voci: VoceValorizzata[]): number {
  return arrotondaCentesimi(voci.reduce((somma, v) => somma + (typeof v.importo === 'number' ? v.importo : 0), 0))
}

export function eseguiCalcolo(input: InputCalcolo): RisultatoCalcolo {
  const incluse = vociIncluse(input.catalogo, input.configurazione)
  const numerate = numeraVoci(incluse)

  const valoriPerId = new Map<string, number>()
  const vociValorizzate: VoceValorizzata[] = []

  for (const { numero, voce } of numerate) {
    const override = input.overrides[voce.id]

    if (override !== undefined) {
      const importo = override
      if (typeof importo === 'number') valoriPerId.set(voce.id, importo)
      vociValorizzate.push({
        numero,
        id: voce.id,
        descrizione: voce.descrizioneTemplate,
        gruppo: voce.gruppo,
        importo,
        provenienza: 'manuale',
      })
      continue
    }

    if (voce.importoTestualeDefault) {
      vociValorizzate.push({
        numero,
        id: voce.id,
        descrizione: voce.descrizioneTemplate,
        gruppo: voce.gruppo,
        importo: voce.importoTestualeDefault,
        provenienza: 'proposto',
      })
      continue
    }

    const driver = driverPer(input.listino, voce.id)
    const importo = driver ? proponiValore(driver, input.geometria, valoriPerId) : 0
    valoriPerId.set(voce.id, importo)
    vociValorizzate.push({
      numero,
      id: voce.id,
      descrizione: voce.descrizioneTemplate,
      gruppo: voce.gruppo,
      importo,
      provenienza: 'proposto',
    })
  }

  const vociGrezzo = vociValorizzate.filter((v) => v.gruppo === 'grezzo')
  const vociPostSconto = vociValorizzate.filter((v) => v.gruppo === 'post_sconto')

  const listinoTotale = sommaNumerica(vociGrezzo)
  const sommaVociPostSconto = sommaNumerica(vociPostSconto) + (typeof input.sicurezza.valorizzata === 'number' ? input.sicurezza.valorizzata : 0)

  const arrotondamento =
    typeof input.arrotondamento === 'number'
      ? input.arrotondamento
      : risolviArrotondamento(listinoTotale, input.sconti, input.arrotondamento.risolviPerTotale, sommaVociPostSconto)

  const sconti = applicaScontiACascata(listinoTotale, input.sconti)
  const parziale = calcolaParziale(listinoTotale, sconti, arrotondamento)
  const totaleNetto = arrotondaCentesimi(parziale + sommaVociPostSconto)

  return {
    vociValorizzate,
    listinoTotale,
    sconti,
    arrotondamento,
    parziale,
    sicurezza: input.sicurezza,
    totaleNetto,
  }
}
