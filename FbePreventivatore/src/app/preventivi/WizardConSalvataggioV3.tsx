'use client'

import { useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { eseguiCalcolo } from '@/domain/calcolo'
import { Button } from './ui/Button'
import { Alert } from './ui/Alert'
import { FormStrutturatoV3 } from './nuovo-v3/FormStrutturatoV3'
import { PulsanteGeneraDocumento } from './ui/PulsanteGeneraDocumento'
import { inputCalcoloDaStato, type StatoForm } from './nuovo/stato-form'
import { calcolaAvvisiCoerenza } from './nuovo/avvisi-coerenza'

interface PreventivoEsistente {
  id: string
  numero: number
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  aggiornamentoEsterno?: { versione: number; parziale: Partial<StatoForm> }
  preventivoEsistente?: PreventivoEsistente
  onSalvato?: (salvataggio: PreventivoEsistente) => void
}

export function WizardConSalvataggioV3({ statoIniziale, aggiornamentoEsterno, preventivoEsistente, onSalvato }: Props) {
  const [stato, setStato] = useState<StatoForm | null>(null)
  const [salvataggio, setSalvataggio] = useState<PreventivoEsistente | null>(preventivoEsistente ?? null)
  const [statoSalvataggio, setStatoSalvataggio] = useState<'inattivo' | 'in-corso' | 'errore'>('inattivo')
  const [messaggioErroreSalvataggio, setMessaggioErroreSalvataggio] = useState('')

  // Senza il pannello preview (rimosso in questa versione) questi erano gli unici avvisi di
  // coerenza visibili nel wizard (protocollo non sostituito, superfici che non tornano,
  // arrotondamento fuori soglia...) — restano qui sotto ai tab invece che sparire del tutto.
  const avvisiCoerenza = useMemo(() => {
    if (!stato) return []
    const input = inputCalcoloDaStato(stato)
    const risultato = eseguiCalcolo(input)
    return calcolaAvvisiCoerenza(stato, input, risultato)
  }, [stato])

  async function salvaBozza(): Promise<boolean> {
    if (!stato) return false
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
        if (!risposta.ok) {
          const corpoErrore = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
          throw new Error(corpoErrore.errore ?? `Errore ${risposta.status}`)
        }
      } else {
        const risposta = await fetch('/api/preventivi', { method: 'POST', body: JSON.stringify(corpo) })
        if (!risposta.ok) {
          const corpoErrore = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
          throw new Error(corpoErrore.errore ?? `Errore ${risposta.status}`)
        }
        const preventivo = await risposta.json()
        const nuovoSalvataggio = { id: preventivo.id, numero: preventivo.revisioni[0].numero }
        setSalvataggio(nuovoSalvataggio)
        onSalvato?.(nuovoSalvataggio)
      }
      setStatoSalvataggio('inattivo')
      return true
    } catch (errore) {
      console.error('Salvataggio bozza fallito:', errore)
      setMessaggioErroreSalvataggio(errore instanceof Error ? errore.message : 'Errore sconosciuto')
      setStatoSalvataggio('errore')
      return false
    }
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 bg-cream p-6 text-text">
      <FormStrutturatoV3 statoIniziale={statoIniziale} aggiornamentoEsterno={aggiornamentoEsterno} onCambiamento={setStato} />
      {avvisiCoerenza.length > 0 && (
        <section aria-label="Avvisi di coerenza" className="space-y-2">
          {avvisiCoerenza.map((avviso, i) => (
            <div key={`${avviso.tipo}-${i}`} data-tipo-avviso={avviso.tipo}>
              <Alert variant="avviso">{avviso.messaggio}</Alert>
            </div>
          ))}
        </section>
      )}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-border-warm bg-cream py-3">
        <Button type="button" onClick={salvaBozza} disabled={!stato || statoSalvataggio === 'in-corso'}>
          <span className="flex items-center gap-2">
            {statoSalvataggio === 'in-corso' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salva bozza
          </span>
        </Button>
        {statoSalvataggio === 'errore' && <Alert variant="errore">{messaggioErroreSalvataggio}</Alert>}
        {salvataggio && (
          <PulsanteGeneraDocumento
            preventivoId={salvataggio.id}
            numero={salvataggio.numero}
            primaDiGenerare={salvaBozza}
          />
        )}
      </div>
    </div>
  )
}
