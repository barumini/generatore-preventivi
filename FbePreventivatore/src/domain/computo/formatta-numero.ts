/**
 * Formato numerico italiano: spazio per le migliaia, virgola decimale.
 * `toLocaleString('it-IT')` userebbe il punto per le migliaia, quindi si sostituisce.
 * Vive nel dominio perché le formule delle regole e l'interfaccia devono concordare:
 * due formattatori separati divergerebbero alla prima modifica.
 */
export function numeroIt(valore: number, decimali = 2): string {
  return valore
    .toLocaleString('it-IT', {
      minimumFractionDigits: decimali,
      maximumFractionDigits: decimali,
      // Senza forzare il raggruppamento l'ICU di it-IT omette il separatore quando la
      // parte intera ha 4 cifre: 1070 uscirebbe "1070,00" invece di "1 070,00", e il
      // golden case di CLAUDE.md ha un arrotondamento di esattamente −1.070,00.
      // `true` e la stringa ES2023 `'always'` producono lo stesso output (verificato
      // su 543,20 / 1 070,00 / 5 843,70 / 9 999,99 / 68 428,78): con `true` il valore
      // è tipizzato correttamente anche col lib TS di progetto (ES2022), senza
      // bisogno del cast che serviva solo ad aggirare il buco nei tipi.
      useGrouping: true,
    })
    .replace(/\./g, ' ')
}

/** Come `numeroIt`, ma senza decimali quando il valore è intero (per quantità e pezzi). */
export function quantitaIt(valore: number): string {
  return numeroIt(valore, Number.isInteger(valore) ? 0 : 2)
}
