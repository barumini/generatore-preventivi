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

export interface SuperficiePiano {
  piano: string
  valoreLordo: string
}

export const PIANI_ABITATIVI = ['Piano Terra', 'Piano Primo', 'Piano sottotetto'] as const
export const PIANO_GARAGE = 'Garage'

export function risolviValoreLordo(valore: string): number {
  if (valore.trim() === '') return 0
  return valore
    .split('+')
    .map((parte) => Number.parseFloat(parte.trim().replace(',', '.')))
    .reduce((somma, numero) => somma + (Number.isNaN(numero) ? 0 : numero), 0)
}

export function totaleSuperficiLorde(superfici: SuperficiePiano[]): number {
  return arrotonda2(
    superfici
      .filter((s) => s.piano !== PIANO_GARAGE)
      .reduce((somma, s) => somma + risolviValoreLordo(s.valoreLordo), 0),
  )
}

export function superficieGarage(superfici: SuperficiePiano[]): number {
  const riga = superfici.find((s) => s.piano === PIANO_GARAGE)
  return riga ? risolviValoreLordo(riga.valoreLordo) : 0
}

export function numeroPianiAbitativi(superfici: SuperficiePiano[]): number {
  const pianiAbitativi: readonly string[] = PIANI_ABITATIVI
  return superfici.filter((s) => pianiAbitativi.includes(s.piano) && risolviValoreLordo(s.valoreLordo) > 0).length
}

export function superficieSedime(superfici: SuperficiePiano[]): number {
  const pianoTerra = superfici.find((s) => s.piano === 'Piano Terra')
  return pianoTerra ? risolviValoreLordo(pianoTerra.valoreLordo) : 0
}
