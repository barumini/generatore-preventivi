// src/app/preventivi/nuovo/PannelloPreview.tsx
'use client'

import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { generaAbacoSerramenti } from '@/ai/abaco'
import { PaginaCaratteristiche } from '@/documento/preview/PaginaCaratteristiche'
import { PaginaPrezzi } from '@/documento/preview/PaginaPrezzi'
import { PaginaAbacoSerramenti } from '@/documento/preview/PaginaAbacoSerramenti'
import type { StatoForm } from './stato-form'

interface Props {
  stato: StatoForm
  input: InputCalcolo
}

export function PannelloPreview({ stato, input }: Props) {
  const risultato = eseguiCalcolo(input)
  const abaco = generaAbacoSerramenti(stato.serramenti)

  return (
    <div>
      <PaginaCaratteristiche
        sistemaCostruttivo="MassivHolzMauer® (M.H.M.)"
        tetto="Tetto con travi e perline in abete"
        mantoCopertura="Tegole in cemento"
        finituraEsterna="Intonaco"
        pacchetto="Grezzo avanzato"
        superfici={stato.superfici.filter((s) => s.piano !== 'Garage')}
        superficieGarage={stato.superfici.find((s) => s.piano === 'Garage')?.valoreLordo ?? ''}
      />
      <PaginaPrezzi risultato={risultato} annoListino={input.listino.anno} />
      <PaginaAbacoSerramenti abaco={abaco} />
    </div>
  )
}
