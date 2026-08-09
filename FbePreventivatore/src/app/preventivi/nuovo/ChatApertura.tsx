// src/app/preventivi/nuovo/ChatApertura.tsx
'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import { controlClassName } from '../ui/Field'
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
    <div className="mb-5 rounded-lg border border-border-warm bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-accent">
        <Sparkles size={16} />
        <span className="text-[11px] font-bold uppercase tracking-wide">Apertura rapida</span>
      </div>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Descrivi il progetto in una frase: cliente, località, superfici, pacchetto..."
        rows={3}
        className={`${controlClassName} mb-3 resize-none`}
      />
      <Button onClick={invia} disabled={caricamento || testo.trim() === ''}>
        {caricamento ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Sto leggendo...
          </span>
        ) : (
          'Compila dal testo'
        )}
      </Button>
      {errore && (
        <div className="mt-2">
          <Alert variant="errore">{errore}</Alert>
        </div>
      )}
    </div>
  )
}
