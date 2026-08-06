import type { RisultatoCalcolo } from '@/domain/calcolo'

/**
 * Logica di presentazione condivisa fra la preview (`preview/PaginaPrezzi.tsx`) e l'export
 * (`export-docx.ts`) per la tabella prezzi di pag. 5 — estratta dopo che la code review di
 * Task 17 ha rilevato la stessa logica duplicata byte-per-byte nei due file (filtro
 * grezzo/post_sconto, segno dell'arrotondamento, arrotondamento delle percentuali): un
 * cambiamento a una delle due implementazioni poteva divergere silenziosamente dall'altra,
 * senza che nessun test se ne accorgesse.
 */

export function righeVoci(risultato: RisultatoCalcolo) {
  return {
    vociGrezzo: risultato.vociValorizzate.filter((v) => v.gruppo === 'grezzo'),
    vociPostSconto: risultato.vociValorizzate.filter((v) => v.gruppo === 'post_sconto'),
  }
}

/**
 * Arrotondamento > 0: leva sottratta dal parziale (caso comune, come nel golden case).
 * Arrotondamento < 0: `risolviArrotondamento` ha risolto il problema inverso richiedendo di
 * aggiungere al parziale — il segno mostrato deve seguirlo, altrimenti si legge un doppio
 * negativo ("- -50,00 €") su un documento firmato dal cliente.
 */
export function segnoArrotondamento(arrotondamento: number): '+' | '-' {
  return arrotondamento < 0 ? '+' : '-'
}

export function formattaPercentuale(frazione: number): string {
  return `${(frazione * 100).toFixed(0)}%`
}
