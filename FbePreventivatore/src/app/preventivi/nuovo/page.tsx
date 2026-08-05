// src/app/preventivi/nuovo/page.tsx
'use client'

import { useState } from 'react'
import { ChatApertura } from './ChatApertura'
import { FormStrutturato } from './FormStrutturato'
import { PannelloPreview } from './PannelloPreview'
import { inputCalcoloDaStato, type StatoForm } from './stato-form'

export default function NuovoPreventivo() {
  const [statoIniziale, setStatoIniziale] = useState<Partial<StatoForm>>({})
  const [versioneEstrazione, setVersioneEstrazione] = useState(0)
  const [stato, setStato] = useState<StatoForm | null>(null)

  return (
    <div>
      <ChatApertura
        onEstrazioneCompletata={(parziale) => {
          setStatoIniziale(parziale)
          // FormStrutturato inizializza il proprio stato da statoIniziale solo al mount:
          // cambiare la key forza un remount così il form si ripopola con i campi estratti.
          setVersioneEstrazione((v) => v + 1)
        }}
      />
      <div style={{ display: 'flex', gap: '24px' }}>
        <div style={{ flex: 1 }}>
          <FormStrutturato key={versioneEstrazione} statoIniziale={statoIniziale} onCambiamento={setStato} />
        </div>
        <div style={{ flex: 1 }}>
          {stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}
        </div>
      </div>
    </div>
  )
}
