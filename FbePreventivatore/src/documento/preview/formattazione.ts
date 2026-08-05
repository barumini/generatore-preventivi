export function formattaImportoItaliano(valore: number | string): string {
  if (typeof valore === 'string') return valore
  const parti = valore.toFixed(2).split('.')
  const interi = parti[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${interi},${parti[1]} €`
}
