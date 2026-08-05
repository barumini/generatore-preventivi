// src/app/preventivi/nuovo/ChatApertura.tsx
'use client'

import { useState } from 'react'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import type { StatoForm } from './stato-form'

interface Props {
  onEstrazioneCompletata: (parziale: Partial<StatoForm>, campiMancanti: string[]) => void
}

export function ChatApertura({ onEstrazioneCompletata }: Props) {
  const [testo, setTesto] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function invia() {
    setCaricamento(true)
    setErrore(null)
    try {
      const risposta = await fetch('/api/estrazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo }),
      })
      if (!risposta.ok) throw new Error('Estrazione fallita')
      const campi = await risposta.json()
      onEstrazioneCompletata(statoFormDaCampiEstratti(campi), campi.campiMancanti)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore imprevisto')
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Descrivi il progetto in una frase: cliente, località, superfici, pacchetto..."
      />
      <button onClick={invia} disabled={caricamento || testo.trim() === ''}>
        {caricamento ? 'Sto leggendo...' : 'Compila dal testo'}
      </button>
      {errore && <p role="alert">{errore}</p>}
    </div>
  )
}
