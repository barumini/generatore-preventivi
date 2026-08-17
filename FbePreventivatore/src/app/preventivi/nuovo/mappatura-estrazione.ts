// src/app/preventivi/nuovo/mappatura-estrazione.ts
import type { CampiEstratti } from '@/ai/estrazione'
import { normalizzaNomePiano } from '@/domain/geometria'
import { CARATTERISTICHE_DEFAULT, livelliDaPacchetto, OGGETTO_STANDARD, type StatoForm } from './stato-form'

export function statoFormDaCampiEstratti(campi: CampiEstratti): Partial<StatoForm> {
  const parziale: Partial<StatoForm> = {
    cliente: {
      nome: campi.cliente.nome,
      comune: campi.cliente.comune ?? '',
      provincia: campi.cliente.provincia ?? '',
    },
    // Il prompt chiede i nomi canonici, ma il modello può comunque restituire
    // "Piano terra" o "garage": il dominio confronta per stringa esatta, quindi
    // una variante non normalizzata sposterebbe i prezzi in silenzio. Un nome
    // che non si riconosce resta com'è e il form lo segnala da correggere.
    superfici: campi.superfici.map((s) => ({ ...s, piano: normalizzaNomePiano(s.piano) })),
    // aggiorna()/il merge esterno sovrascrivono questa chiave per intero (non fanno merge
    // annidato), quindi qui è sicuro comporre l'oggetto completo invece di un default parziale.
    caratteristiche: {
      ...CARATTERISTICHE_DEFAULT,
      ...(campi.tipoCopertura ? { copertura: campi.tipoCopertura } : {}),
      ...(campi.finituraEsterna ? { finituraEsterna: campi.finituraEsterna } : {}),
    },
    // Quasi sempre la stessa frase per ogni preventivo MHM: mai richiesta via AI/dialogo,
    // resta comunque modificabile a mano nel tab Anagrafica.
    oggetto: OGGETTO_STANDARD,
    // Nessuna semantica documentata oltre "luogo associato alla revisione": il golden
    // case Crivellaro lo valorizza col comune cliente, e questo fallback segue quel
    // precedente finché non emerge una regola diversa.
    luogo: campi.luogo ?? campi.cliente.comune ?? '',
  }

  if (campi.protocollo) parziale.protocollo = campi.protocollo
  if (campi.progettista) parziale.progettista = campi.progettista
  if (campi.pacchetto) parziale.livelli = livelliDaPacchetto(campi.pacchetto)

  return parziale
}
