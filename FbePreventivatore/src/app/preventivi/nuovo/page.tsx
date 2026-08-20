// src/app/preventivi/nuovo/page.tsx
'use client'

import { useState } from 'react'
import { ChatApertura } from './ChatApertura'
import { WizardConSalvataggio } from '../WizardConSalvataggio'
import { Breadcrumb } from '../ui/Breadcrumb'
import type { StatoForm } from './stato-form'

const STATO_INIZIALE_VUOTO: Partial<StatoForm> = {}

export default function NuovoPreventivo() {
  const [aggiornamentoEsterno, setAggiornamentoEsterno] = useState<
    { versione: number; parziale: Partial<StatoForm> } | undefined
  >()
  const [salvataggio, setSalvataggio] = useState<{ id: string; numero: number } | undefined>()

  return (
    <div className="mx-auto max-w-[1400px] px-6 pt-6">
      <Breadcrumb
        voci={[{ label: 'Home', href: '/' }, { label: 'Preventivi', href: '/preventivi' }, { label: 'Nuovo preventivo' }]}
      />
      <ChatApertura
        onEstrazioneCompletata={(parziale) => {
          setAggiornamentoEsterno((precedente) => ({ versione: (precedente?.versione ?? 0) + 1, parziale }))
        }}
      />
      <WizardConSalvataggio
        statoIniziale={STATO_INIZIALE_VUOTO}
        aggiornamentoEsterno={aggiornamentoEsterno}
        preventivoEsistente={salvataggio}
        onSalvato={setSalvataggio}
      />
    </div>
  )
}
