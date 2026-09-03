/**
 * Formato numerico italiano: spazio per le migliaia, virgola decimale.
 * `toLocaleString('it-IT')` userebbe il punto per le migliaia, quindi si sostituisce.
 * Vive nel dominio perché le formule delle regole e l'interfaccia devono concordare:
 * due formattatori separati divergerebbero alla prima modifica.
 */
export function numeroIt(valore: number, decimali = 2): string {
  return valore
    .toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: 2 })
    .replace(/\./g, ' ')
}

/** Come `numeroIt`, ma senza decimali quando il valore è intero (per quantità e pezzi). */
export function quantitaIt(valore: number): string {
  return numeroIt(valore, Number.isInteger(valore) ? 0 : 2)
}
