// src/app/preventivi/nuovo/mappatura-estrazione.ts
import type { CampiEstratti } from '@/ai/estrazione'
import type { StatoForm } from './stato-form'

export function statoFormDaCampiEstratti(campi: CampiEstratti): Partial<StatoForm> {
  const parziale: Partial<StatoForm> = {
    cliente: {
      nome: campi.cliente.nome,
      comune: campi.cliente.comune ?? '',
      provincia: campi.cliente.provincia ?? '',
    },
    superfici: campi.superfici,
  }

  if (campi.protocollo) parziale.protocollo = campi.protocollo

  return parziale
}
