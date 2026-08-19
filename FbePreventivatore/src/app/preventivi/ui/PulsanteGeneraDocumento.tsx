'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { Alert } from './Alert'

interface Props {
  preventivoId: string
  numero: number
  primaDiGenerare: () => Promise<boolean>
}

function nomeFileDaContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/filename="([^"]+)"/)
  return match ? match[1] : null
}

export function PulsanteGeneraDocumento({ preventivoId, numero, primaDiGenerare }: Props) {
  const [stato, setStato] = useState<'inattivo' | 'in-corso' | 'errore'>('inattivo')
  const [messaggioErrore, setMessaggioErrore] = useState('')

  async function generaDocumento() {
    setStato('in-corso')
    try {
      const salvataggioRiuscito = await primaDiGenerare()
      if (!salvataggioRiuscito) {
        throw new Error('Salvataggio delle modifiche fallito: il documento non è stato generato.')
      }

      const risposta = await fetch(`/api/preventivi/${preventivoId}/revisioni/${numero}/export`, { method: 'POST' })
      if (!risposta.ok) {
        const corpo = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
        throw new Error(corpo.errore ?? `Errore ${risposta.status}`)
      }

      const blob = await risposta.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nomeFileDaContentDisposition(risposta.headers.get('Content-Disposition')) ?? 'offerta.docx'
      link.click()
      URL.revokeObjectURL(url)

      setStato('inattivo')
    } catch (errore) {
      console.error('Generazione documento fallita:', errore)
      setMessaggioErrore(errore instanceof Error ? errore.message : 'Errore sconosciuto')
      setStato('errore')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" onClick={generaDocumento} disabled={stato === 'in-corso'}>
        <span className="flex items-center gap-2">
          {stato === 'in-corso' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Genera documento
        </span>
      </Button>
      {stato === 'errore' && <Alert variant="errore">{messaggioErrore}</Alert>}
    </div>
  )
}
