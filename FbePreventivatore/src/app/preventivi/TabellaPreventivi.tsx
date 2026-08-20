'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from './ui/Button'
import { Alert } from './ui/Alert'
import { scaricaDocumentoDaRisposta } from './ui/scarica-blob'

interface RigaPreventivo {
  id: string
  protocollo: string
  cliente: { nome: string }
  ultimaRevisione: { numero: number; stato: string; documentoGenerato: boolean } | null
}

export function TabellaPreventivi({ preventivi }: { preventivi: RigaPreventivo[] }) {
  const router = useRouter()
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set())
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false)
  const [scaricamentoInCorso, setScaricamentoInCorso] = useState<string | null>(null)
  const [messaggioErrore, setMessaggioErrore] = useState('')

  function alternaSelezione(id: string) {
    setSelezionati((precedente) => {
      const successivo = new Set(precedente)
      if (successivo.has(id)) successivo.delete(id)
      else successivo.add(id)
      return successivo
    })
  }

  function alternaSelezionaTutto() {
    setSelezionati((precedente) => (precedente.size === preventivi.length ? new Set() : new Set(preventivi.map((p) => p.id))))
  }

  async function eliminaSelezionati() {
    if (selezionati.size === 0) return
    const conferma = window.confirm(
      `Eliminare ${selezionati.size} preventivo${selezionati.size > 1 ? 'i' : ''}? L'operazione è irreversibile.`,
    )
    if (!conferma) return

    setEliminazioneInCorso(true)
    setMessaggioErrore('')
    try {
      const risposta = await fetch('/api/preventivi', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selezionati) }),
      })
      if (!risposta.ok) {
        const corpo = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
        throw new Error(corpo.errore ?? `Errore ${risposta.status}`)
      }
      setSelezionati(new Set())
      router.refresh()
    } catch (errore) {
      setMessaggioErrore(errore instanceof Error ? errore.message : 'Errore sconosciuto')
    } finally {
      setEliminazioneInCorso(false)
    }
  }

  async function scaricaDocumento(p: RigaPreventivo) {
    if (!p.ultimaRevisione) return
    setScaricamentoInCorso(p.id)
    setMessaggioErrore('')
    try {
      const risposta = await fetch(`/api/preventivi/${p.id}/revisioni/${p.ultimaRevisione.numero}/export`, {
        method: 'POST',
      })
      await scaricaDocumentoDaRisposta(risposta, `${p.protocollo}.docx`)
    } catch (errore) {
      setMessaggioErrore(errore instanceof Error ? errore.message : 'Errore sconosciuto')
    } finally {
      setScaricamentoInCorso(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={eliminaSelezionati} disabled={selezionati.size === 0 || eliminazioneInCorso}>
          <span className="flex items-center gap-2 text-error">
            {eliminazioneInCorso ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Elimina selezionati{selezionati.size > 0 ? ` (${selezionati.size})` : ''}
          </span>
        </Button>
        {messaggioErrore && <Alert variant="errore">{messaggioErrore}</Alert>}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-warm bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-warm bg-cream text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={preventivi.length > 0 && selezionati.size === preventivi.length}
                  onChange={alternaSelezionaTutto}
                  aria-label="Seleziona tutti i preventivi"
                />
              </th>
              <th className="px-4 py-2.5">Cliente</th>
              <th className="px-4 py-2.5">Protocollo</th>
              <th className="px-4 py-2.5">Ultima revisione</th>
              <th className="px-4 py-2.5">Stato</th>
              <th className="px-4 py-2.5"></th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {preventivi.map((p) => (
              <tr key={p.id} className="border-b border-border-warm last:border-b-0">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selezionati.has(p.id)}
                    onChange={() => alternaSelezione(p.id)}
                    aria-label={`Seleziona il preventivo ${p.protocollo}`}
                  />
                </td>
                <td className="px-4 py-2.5 text-text">{p.cliente.nome}</td>
                <td className="px-4 py-2.5 text-text-secondary">{p.protocollo}</td>
                <td className="px-4 py-2.5 text-text-secondary">{p.ultimaRevisione?.numero ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-secondary">{p.ultimaRevisione?.stato ?? '—'}</td>
                <td className="px-4 py-2.5">
                  {p.ultimaRevisione && (
                    <Link
                      href={`/preventivi/${p.id}/revisioni/${p.ultimaRevisione.numero}`}
                      className="font-semibold text-accent hover:text-accent-hover"
                    >
                      Apri
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {p.ultimaRevisione?.documentoGenerato && (
                    <button
                      type="button"
                      onClick={() => scaricaDocumento(p)}
                      disabled={scaricamentoInCorso === p.id}
                      className="flex items-center gap-1.5 font-semibold text-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Scarica il documento Word del preventivo ${p.protocollo}`}
                    >
                      {scaricamentoInCorso === p.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      Scarica
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
