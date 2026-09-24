import { CASI_VALUTAZIONE, type CasoValutazione } from '../valutazione-estrazione'
import { CASI_AVVERSARI_ANAGRAFICA } from './avversari-anagrafica'
import { CASI_AVVERSARI_CONVERSAZIONE } from './avversari-conversazione'
import { CASI_AVVERSARI_FORMATI } from './avversari-formati'
import { CASI_CONTROLLO } from './controllo'

// I tre insiemi su cui si confrontano sistemi e modelli di estrazione. Vanno letti separati:
// - sviluppo: i casi Crivellaro su cui si mettono a punto prompt ed esempi (superarli è il
//   minimo, non dice nulla sulla generalizzazione);
// - controllo: casi scritti a parte, mai usati per la messa a punto;
// - avversari: casi scritti dopo lo sviluppo per mettere in difficoltà l'estrazione su
//   formati numerici, conversazioni a turni, anagrafiche e negazioni.
// Un sistema che migliora lo sviluppo e peggiora gli altri due si sta adattando ai casi.
export type NomeInsieme = 'sviluppo' | 'controllo' | 'avversari'

export const INSIEMI_VALUTAZIONE: Record<NomeInsieme, CasoValutazione[]> = {
  sviluppo: CASI_VALUTAZIONE,
  controllo: CASI_CONTROLLO,
  avversari: [...CASI_AVVERSARI_FORMATI, ...CASI_AVVERSARI_CONVERSAZIONE, ...CASI_AVVERSARI_ANAGRAFICA],
}
