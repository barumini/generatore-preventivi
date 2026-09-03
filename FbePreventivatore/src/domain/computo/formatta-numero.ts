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
      // Senza `useGrouping: 'always'` l'ICU di it-IT omette il separatore quando la
      // parte intera ha 4 cifre: 1070 uscirebbe "1070,00" invece di "1 070,00", e il
      // golden case di CLAUDE.md ha un arrotondamento di esattamente −1.070,00.
      // Il valore stringa è un `NumberFormatOptions` valido a runtime (ECMA-402 v3,
      // verificato su Node 20) ma il lib TS di progetto (ES2022) tipizza ancora
      // `useGrouping` come solo booleano: il cast aggira un buco nei tipi, non un
      // vincolo del motore JS. Non si tocca tsconfig.json per non allargare il lib
      // a tutto il progetto per un solo valore usato in un punto.
      useGrouping: 'always' as unknown as boolean,
    })
    .replace(/\./g, ' ')
}

/** Come `numeroIt`, ma senza decimali quando il valore è intero (per quantità e pezzi). */
export function quantitaIt(valore: number): string {
  return numeroIt(valore, Number.isInteger(valore) ? 0 : 2)
}
