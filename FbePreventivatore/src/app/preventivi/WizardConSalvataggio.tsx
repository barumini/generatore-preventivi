'use client'

import { useState } from 'react'
import { eseguiCalcolo } from '@/domain/calcolo'
import { FormStrutturato } from './nuovo/FormStrutturato'
import { PannelloPreview } from './nuovo/PannelloPreview'
import { inputCalcoloDaStato, type StatoForm } from './nuovo/stato-form'

interface PreventivoEsistente {
  id: string
  numero: number
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  preventivoEsistente?: PreventivoEsistente
}

export function WizardConSalvataggio({ statoIniziale, preventivoEsistente }: Props) {
  const [stato, setStato] = useState<StatoForm | null>(null)
  const [salvataggio, setSalvataggio] = useState<PreventivoEsistente | null>(preventivoEsistente ?? null)
  const [statoSalvataggio, setStatoSalvataggio] = useState<'inattivo' | 'in-corso' | 'errore'>('inattivo')

  async function salvaBozza() {
    if (!stato) return
    setStatoSalvataggio('in-corso')
    const input = inputCalcoloDaStato(stato)
    const risultato = eseguiCalcolo(input)
    const corpo = {
      cliente: stato.cliente,
      protocollo: stato.protocollo,
      oggetto: stato.oggetto,
      progettista: stato.progettista,
      data: stato.data,
      luogo: stato.luogo,
      statoForm: JSON.stringify(stato),
      inputCalcolo: JSON.stringify(input),
      risultatoCalcolo: JSON.stringify(risultato),
    }
    try {
      if (salvataggio) {
        const risposta = await fetch(`/api/preventivi/${salvataggio.id}/revisioni/${salvataggio.numero}`, {
          method: 'PUT',
          body: JSON.stringify(corpo),
        })
        if (!risposta.ok) throw new Error('Salvataggio fallito')
      } else {
        const risposta = await fetch('/api/preventivi', { method: 'POST', body: JSON.stringify(corpo) })
        if (!risposta.ok) throw new Error('Salvataggio fallito')
        const preventivo = await risposta.json()
        setSalvataggio({ id: preventivo.id, numero: preventivo.revisioni[0].numero })
      }
      setStatoSalvataggio('inattivo')
    } catch {
      setStatoSalvataggio('errore')
    }
  }

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      <div style={{ flex: 1 }}>
        <FormStrutturato statoIniziale={statoIniziale} onCambiamento={setStato} />
        <button type="button" onClick={salvaBozza} disabled={!stato || statoSalvataggio === 'in-corso'}>
          Salva bozza
        </button>
        {statoSalvataggio === 'errore' && <p role="alert">Salvataggio fallito, riprova.</p>}
      </div>
      <div style={{ flex: 1 }}>{stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}</div>
    </div>
  )
}
