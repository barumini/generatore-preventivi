import { numeroIt, quantitaIt } from '@/domain/computo/formatta-numero'

/** Formato importi FBE: spazio per le migliaia, virgola decimale (CLAUDE.md). */
export function formattaEuro(valore: number): string {
  return `${numeroIt(valore)} €`
}

export function formattaQuantita(valore: number, unita: string): string {
  return `${quantitaIt(valore)} ${unita}`
}
