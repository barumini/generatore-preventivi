'use client'

import { useState } from 'react'
import { ImportazioneExcel } from './ImportazioneExcel'
import { WizardConSalvataggio } from '../WizardConSalvataggio'
import { Breadcrumb } from '../ui/Breadcrumb'
import type { StatoForm } from '../nuovo/stato-form'

const STATO_INIZIALE_VUOTO: Partial<StatoForm> = {}

export default function NuovoPreventivoV2() {
  const [aggiornamentoEsterno, setAggiornamentoEsterno] = useState<
    { versione: number; parziale: Partial<StatoForm> } | undefined
  >()
  const [salvataggio, setSalvataggio] = useState<{ id: string; numero: number } | undefined>()

  return (
    <div className="mx-auto max-w-[1400px] px-6 pt-6">
      <Breadcrumb
        voci={[
          { label: 'Home', href: '/' },
          { label: 'Preventivi', href: '/preventivi' },
          { label: 'Nuovo preventivo (import Excel)' },
        ]}
      />
      <ImportazioneExcel
        onImportazioneCompletata={(parziale) => {
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
