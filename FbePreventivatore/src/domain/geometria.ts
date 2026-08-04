export interface Serramento {
  n: number
  piano: string
  tipologia: string
  b: number
  h: number
}

export interface AperturaCalcolata extends Serramento {
  areaLorda: number
  larghezzaNetta: number
  altezzaNetta: number
  areaNetta: number
}

export interface DetrazioniSerramenti {
  orizzontale: number
  verticale: number
}

export const DETRAZIONI_DEFAULT: DetrazioniSerramenti = { orizzontale: 0.6, verticale: 0.3 }

function arrotonda2(valore: number): number {
  return Math.round(valore * 100) / 100
}

export function calcolaApertura(
  serramento: Serramento,
  detrazioni: DetrazioniSerramenti = DETRAZIONI_DEFAULT,
): AperturaCalcolata {
  const areaLorda = arrotonda2(serramento.b * serramento.h)
  const larghezzaNetta = arrotonda2(serramento.b - detrazioni.orizzontale)
  const altezzaNetta = arrotonda2(serramento.h - detrazioni.verticale)
  const areaNetta = arrotonda2(larghezzaNetta * altezzaNetta)
  return { ...serramento, areaLorda, larghezzaNetta, altezzaNetta, areaNetta }
}

export function totaliSerramenti(
  serramenti: Serramento[],
  detrazioni: DetrazioniSerramenti = DETRAZIONI_DEFAULT,
): { aperture: AperturaCalcolata[]; areaLordaTotale: number; areaNettaTotale: number; numero: number } {
  const aperture = serramenti.map((s) => calcolaApertura(s, detrazioni))
  const areaLordaTotale = arrotonda2(aperture.reduce((somma, a) => somma + a.areaLorda, 0))
  const areaNettaTotale = arrotonda2(aperture.reduce((somma, a) => somma + a.areaNetta, 0))
  return { aperture, areaLordaTotale, areaNettaTotale, numero: serramenti.length }
}
