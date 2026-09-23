// src/app/preventivi/nuovo/avvisi-coerenza.ts
import { totaleSuperficiLorde } from '@/domain/geometria'
import type { InputCalcolo, RisultatoCalcolo } from '@/domain/calcolo'
import { isProtocolloPlaceholder, verificaCoerenza, type Avviso } from '@/ai/coerenza'
import type { StatoForm } from './stato-form'

// Condiviso fra PannelloPreview (v1/v2) e la barra avvisi del wizard v3 (senza preview):
// stessa logica di verificaCoerenza, senza duplicarne la costruzione dell'input in due posti.
export function calcolaAvvisiCoerenza(stato: StatoForm, input: InputCalcolo, risultato: RisultatoCalcolo): Avviso[] {
  return verificaCoerenza({
    superfici: stato.superfici,
    totaleLordoDichiarato: stato.totaleLordoManuale ?? totaleSuperficiLorde(stato.superfici),
    risultato,
    protocolloPlaceholderPresente: isProtocolloPlaceholder(stato.protocollo),
    sezioniDaDefinire: [],
    riferimentiTestuali: [],
  })
}
