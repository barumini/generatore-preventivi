export interface ParametriSconto {
  percentuale: number
  causale: string
}

export interface Sconto extends ParametriSconto {
  ordine: number
  importoCalcolato: number
}

export function arrotondaCentesimi(valore: number): number {
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

/**
 * Passo di default per il totale commerciale calcolato: 5 000 €. È la regola che riproduce
 * entrambi i golden case senza digitare il totale — Crivellaro 301 070 → 300 000 (arr. 1 070),
 * Da Croce 256 793,76 → 255 000 (e 257 184 → 255 000 col listino dell'offerta rev.02).
 */
export const PASSO_ARROTONDAMENTO_DEFAULT = 5000

/**
 * Arrotonda per difetto al multiplo di `passo`: il cliente non vede mai il prezzo salire per
 * effetto dell'arrotondamento. Passo non positivo = nessun arrotondamento.
 */
export function totaleArrotondatoPerDifetto(totaleNaturale: number, passo: number): number {
  if (!(passo > 0)) return totaleNaturale
  // tolleranza sui centesimi: un totale già tondo (255 000,00) non deve scendere di un passo
  return Math.floor(arrotondaCentesimi(totaleNaturale) / passo + 1e-9) * passo
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
  // number = arrotondamento digitato; risolviPerTotale = totale target digitato;
  // arrotondaTotalePerDifettoA = totale calcolato (totale senza arrotondamento, per difetto al passo).
  arrotondamento: number | { risolviPerTotale: number } | { arrotondaTotalePerDifettoA: number }
  // Valori per interpolare i placeholder {{chiave}} nelle descrizioni voce (src/domain/voci.ts,
  // id pareti-mhm/copertura-falda/cappotto). Assente o senza una chiave = quel token resta
  // {{...}} nella descrizione finale, e il guardrail export lo blocca — vedi interpolaPlaceholder.
  spessori?: Record<string, string>
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

const PATTERN_PLACEHOLDER_DOPPIA_GRAFFA = /\{\{[^{}]+\}\}/g

/**
 * Cerca, nelle descrizioni delle voci di catalogo, placeholder a doppia graffa (es.
 * `{{spessoreEsterno}}`) rimasti non interpolati perché il campo spessore corrispondente è
 * stato lasciato vuoto nello step "Configurazione" del wizard — non tag docxtemplater (quelli
 * sono a graffa singola), ma testo letterale rimasto nel dato di dominio dopo il passaggio da
 * `interpolaPlaceholder`. Esportata anche per il test: la review di Task 17 chiede che
 * l'insieme esatto dei token rilevati sia verificato, così una correzione parziale in futuro
 * fa fallire un test invece di passare inosservata.
 */
export function rilevaPlaceholderSpessoreNonInterpolati(voci: VoceValorizzata[]): string[] {
  const trovati: string[] = []
  for (const v of voci) {
    const match = v.descrizione.match(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA)
    if (match) trovati.push(...match)
  }
  return trovati
}

/**
 * Sostituisce ogni `{{chiave}}` presente nel template con `valori[chiave]`, solo se il
 * valore esiste e non è vuoto (dopo trim). Un campo lasciato in bianco nel wizard deve
 * continuare a far scattare `rilevaPlaceholderSpessoreNonInterpolati` più a valle — quindi
 * qui il token va lasciato intatto, non sostituito con una stringa vuota che produrrebbe una
 * descrizione senza numero ma senza più nessun `{{...}}` da rilevare.
 */
export function interpolaPlaceholder(template: string, valori: Record<string, string> | undefined): string {
  if (!valori) return template
  return template.replace(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA, (token) => {
    const chiave = token.slice(2, -2)
    const valore = valori[chiave]
    return valore && valore.trim() !== '' ? valore.trim() : token
  })
}

export interface SegmentoDescrizione {
  testo: string
  placeholder: boolean
}

/**
 * Spezza una descrizione voce in segmenti di testo normale e segmenti-placeholder, nello
 * stesso ordine del testo originale — usato dalla preview per colorare in grigio solo il
 * token residuo (src/documento/preview/DescrizioneVoce.tsx), senza toccare il resto della
 * frase.
 */
export function segmentaPlaceholder(descrizione: string): SegmentoDescrizione[] {
  const segmenti: SegmentoDescrizione[] = []
  let ultimoIndice = 0
  for (const match of descrizione.matchAll(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA)) {
    const indice = match.index ?? 0
    if (indice > ultimoIndice) segmenti.push({ testo: descrizione.slice(ultimoIndice, indice), placeholder: false })
    segmenti.push({ testo: match[0], placeholder: true })
    ultimoIndice = indice + match[0].length
  }
  if (ultimoIndice < descrizione.length || segmenti.length === 0) {
    segmenti.push({ testo: descrizione.slice(ultimoIndice), placeholder: false })
  }
  return segmenti
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
        descrizione: interpolaPlaceholder(voce.descrizioneTemplate, input.spessori),
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
        descrizione: interpolaPlaceholder(voce.descrizioneTemplate, input.spessori),
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
      descrizione: interpolaPlaceholder(voce.descrizioneTemplate, input.spessori),
      gruppo: voce.gruppo,
      importo,
      provenienza: 'proposto',
    })
  }

  const vociGrezzo = vociValorizzate.filter((v) => v.gruppo === 'grezzo')
  const vociPostSconto = vociValorizzate.filter((v) => v.gruppo === 'post_sconto')

  const listinoTotale = sommaNumerica(vociGrezzo)
  const sommaVociPostSconto = sommaNumerica(vociPostSconto) + (typeof input.sicurezza.valorizzata === 'number' ? input.sicurezza.valorizzata : 0)

  const sconti = applicaScontiACascata(listinoTotale, input.sconti)

  let arrotondamento: number
  if (typeof input.arrotondamento === 'number') {
    arrotondamento = input.arrotondamento
  } else {
    const totaleTarget =
      'risolviPerTotale' in input.arrotondamento
        ? input.arrotondamento.risolviPerTotale
        : totaleArrotondatoPerDifetto(
            calcolaParziale(listinoTotale, sconti, 0) + sommaVociPostSconto,
            input.arrotondamento.arrotondaTotalePerDifettoA,
          )
    arrotondamento = risolviArrotondamento(listinoTotale, input.sconti, totaleTarget, sommaVociPostSconto)
  }

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
