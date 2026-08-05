import { totaleSuperficiLorde, type SuperficiePiano } from '@/domain/geometria'
import { sogliaArrotondamentoSuperata, type RisultatoCalcolo } from '@/domain/calcolo'

export interface Avviso {
  tipo:
    | 'superfici-incoerenti'
    | 'placeholder-non-sostituito'
    | 'sezione-da-definire'
    | 'arrotondamento-eccessivo'
    | 'riferimento-voce-inesistente'
  messaggio: string
}

export interface RiferimentoTestuale {
  numeroCitato: string
  contesto: string
}

export interface InputVerificaCoerenza {
  superfici: SuperficiePiano[]
  totaleLordoDichiarato: number
  risultato: RisultatoCalcolo
  protocolloPlaceholderPresente: boolean
  sezioniDaDefinire: string[]
  riferimentiTestuali: RiferimentoTestuale[]
}

export function verificaCoerenza(input: InputVerificaCoerenza): Avviso[] {
  const avvisi: Avviso[] = []

  const totaleReale = totaleSuperficiLorde(input.superfici)
  if (Math.abs(totaleReale - input.totaleLordoDichiarato) > 0.01) {
    avvisi.push({
      tipo: 'superfici-incoerenti',
      messaggio: `La somma delle superfici (${totaleReale} mq) non coincide col totale dichiarato (${input.totaleLordoDichiarato} mq)`,
    })
  }

  if (input.protocolloPlaceholderPresente) {
    avvisi.push({
      tipo: 'placeholder-non-sostituito',
      messaggio: 'È presente un placeholder di protocollo non sostituito in copertina',
    })
  }

  for (const sezione of input.sezioniDaDefinire) {
    avvisi.push({
      tipo: 'sezione-da-definire',
      messaggio: `La sezione "${sezione}" è ancora marcata "da definire"`,
    })
  }

  if (sogliaArrotondamentoSuperata(input.risultato.arrotondamento, input.risultato.listinoTotale)) {
    avvisi.push({
      tipo: 'arrotondamento-eccessivo',
      messaggio: `L'arrotondamento (${input.risultato.arrotondamento} €) supera il 2% del Listino — rivedere sconti o voci`,
    })
  }

  const numeriEsistenti = new Set(input.risultato.vociValorizzate.map((v) => v.numero))
  for (const riferimento of input.riferimentiTestuali) {
    if (!numeriEsistenti.has(riferimento.numeroCitato)) {
      avvisi.push({
        tipo: 'riferimento-voce-inesistente',
        messaggio: `Il testo cita la voce "${riferimento.numeroCitato}" (${riferimento.contesto}), ma questa numerazione non ha una voce "${riferimento.numeroCitato}" — bug reale osservato in Lucarelli rev., verificare se il riferimento va aggiornato o rimosso`,
      })
    }
  }

  return avvisi
}
