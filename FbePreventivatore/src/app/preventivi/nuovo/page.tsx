// src/app/preventivi/nuovo/page.tsx
'use client'

import { useState } from 'react'
import { ChatApertura } from './ChatApertura'
import { WizardConSalvataggio } from '../WizardConSalvataggio'
import type { StatoForm } from './stato-form'

export default function NuovoPreventivo() {
  const [statoIniziale, setStatoIniziale] = useState<Partial<StatoForm>>({})
  const [versioneEstrazione, setVersioneEstrazione] = useState(0)
  const [salvataggio, setSalvataggio] = useState<{ id: string; numero: number } | undefined>()

  return (
    <div>
      <ChatApertura
        onEstrazioneCompletata={(parziale) => {
          setStatoIniziale(parziale)
          setVersioneEstrazione((v) => v + 1)
        }}
      />
      <WizardConSalvataggio
        key={versioneEstrazione}
        statoIniziale={statoIniziale}
        preventivoEsistente={salvataggio}
        onSalvato={setSalvataggio}
      />
    </div>
  )
}
