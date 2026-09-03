/**
 * Un frammento di testo posizionato in un PDF: quanto basta al dominio per
 * ricostruire la griglia di un computo Primus senza sapere nulla dei PDF.
 *
 * `x` e `y` sono in punti tipografici, origine in basso a sinistra della pagina
 * (convenzione PDF, non CSS): y cresce verso l'alto. Sono arrotondati
 * all'intero — le soglie di colonna distano decine di punti, i decimali non
 * servono e raddoppierebbero il peso delle fixture.
 */
export interface FrammentoTesto {
  pagina: number
  x: number
  y: number
  testo: string
}
