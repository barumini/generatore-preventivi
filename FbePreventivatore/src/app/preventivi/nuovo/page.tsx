// src/app/preventivi/nuovo/page.tsx
'use client'

import { useState } from 'react'
import { FormStrutturato } from './FormStrutturato'
import { PannelloPreview } from './PannelloPreview'
import { inputCalcoloDaStato, type StatoForm } from './stato-form'

export default function NuovoPreventivo() {
  const [stato, setStato] = useState<StatoForm | null>(null)

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      <div style={{ flex: 1 }}>
        <FormStrutturato onCambiamento={setStato} />
      </div>
      <div style={{ flex: 1 }}>
        {stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}
      </div>
    </div>
  )
}
