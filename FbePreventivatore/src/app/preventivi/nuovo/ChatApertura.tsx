// src/app/preventivi/nuovo/ChatApertura.tsx
'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { controlClassName } from '../ui/Field'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import { messaggioAssistente, testoCumulativo, type Messaggio } from './conversazione-apertura'
import type { CampiEstratti } from '@/ai/estrazione'
import type { StatoForm } from './stato-form'

interface Props {
  onEstrazioneCompletata: (parziale: Partial<StatoForm>) => void
}

export function ChatApertura({ onEstrazioneCompletata }: Props) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>([])
  const [bozza, setBozza] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  async function invia() {
    if (caricamento) return
    const testoUtente = bozza.trim()
    if (testoUtente === '') return

    const cronologia: Messaggio[] = [...messaggi, { ruolo: 'utente', testo: testoUtente }]
    setMessaggi(cronologia)
    setBozza('')
    setCaricamento(true)

    try {
      const risposta = await fetch('/api/estrazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testoCumulativo(cronologia) }),
      })
      if (!risposta.ok) {
        const corpo = await risposta.json().catch(() => null)
        throw new Error(corpo?.errore ?? 'Estrazione fallita')
      }
      const campi = (await risposta.json()) as CampiEstratti
      onEstrazioneCompletata(statoFormDaCampiEstratti(campi))
      // campiMancanti sono id calcolati in codice: messaggioAssistente li traduce in
      // etichette leggibili e non chiede mai il luogo (si deduce dal comune).
      setMessaggi([...cronologia, { ruolo: 'assistente', testo: messaggioAssistente(campi.campiMancanti) }])
    } catch (e) {
      const testoErrore = e instanceof Error ? e.message : 'Errore imprevisto'
      setMessaggi([...cronologia, { ruolo: 'assistente', testo: testoErrore, errore: true }])
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

      {messaggi.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {messaggi.map((messaggio, i) => (
            <div
              key={i}
              className={`rounded-md px-3 py-2 text-sm ${
                messaggio.errore
                  ? 'bg-error/5 text-error'
                  : messaggio.ruolo === 'utente'
                    ? 'bg-border-warm/20 text-text'
                    : 'bg-accent/5 text-text-secondary'
              }`}
            >
              <span className="font-semibold">{messaggio.ruolo === 'utente' ? 'Tu' : 'FBE'}:</span> {messaggio.testo}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={bozza}
        onChange={(e) => setBozza(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            invia()
          }
        }}
        disabled={caricamento}
        placeholder={
          messaggi.length === 0
            ? 'Descrivi il progetto in una frase: cliente, località, superfici, pacchetto...'
            : 'Rispondi qui...'
        }
        rows={3}
        className={`${controlClassName} mb-3 resize-none`}
      />
      <Button onClick={invia} disabled={caricamento || bozza.trim() === ''}>
        {caricamento ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Sto leggendo...
          </span>
        ) : (
          'Invia'
        )}
      </Button>
    </div>
  )
}
