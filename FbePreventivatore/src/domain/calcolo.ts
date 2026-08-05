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
