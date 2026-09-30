// Logica pura di CampoNumerico: separata dal componente perché Vitest gira in ambiente node.
//
// Un <input type="number"> controllato con value={0} non si può svuotare: cancellando lo zero
// l'onChange riceve '', Number('') torna 0 e React riscrive subito "0" nel campo. Il campo vuoto
// vale quindi 0 per lo stato, ma resta vuoto a schermo (con "0" come segnaposto).

export function testoDaValore(valore: number): string {
  // toPrecision(12) toglie il rumore dei valori riscalati (0,07 × 100) prima di mostrarli.
  return valore === 0 ? '' : String(Number(valore.toPrecision(12)))
}

export function valoreDaTesto(testo: string): number {
  return testo.trim() === '' ? 0 : Number(testo)
}

// Tolleranza per i valori riscalati dal chiamante (es. 0,07 × 100 = 7,000000000000001): senza,
// la percentuale digitata verrebbe riscritta nel campo con il rumore in virgola mobile.
export function testoCoerente(testo: string, valore: number): boolean {
  return Math.abs(valoreDaTesto(testo) - valore) < 1e-9
}
