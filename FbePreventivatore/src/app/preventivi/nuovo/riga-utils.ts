export function aggiornaRiga<T>(righe: T[], indice: number, parziale: Partial<T>): T[] {
  return righe.map((riga, i) => (i === indice ? { ...riga, ...parziale } : riga))
}

export function rimuoviRiga<T>(righe: T[], indice: number): T[] {
  return righe.filter((_, i) => i !== indice)
}
