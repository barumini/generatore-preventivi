'use client'

import { useState } from 'react'
import { FileText, Loader2, Upload } from 'lucide-react'
import { Alert } from '../ui/Alert'
import { frammentiDaPdf } from './leggi-pdf'
import { estraiComputo, verificaIntegrita, type Computo } from '@/domain/computo/estrai-voci'
import { formattaEuro } from './formatta'

interface Props {
  computo: Computo | null
  onComputo: (computo: Computo, nomeFile: string) => void
  nomeFile: string | null
}

export function CaricamentoComputo({ computo, onComputo, nomeFile }: Props) {
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function leggi(file: File) {
    setInCorso(true)
    setErrore(null)
    try {
      const frammenti = await frammentiDaPdf(await file.arrayBuffer())
      const estratto = estraiComputo(frammenti)
      if (estratto.voci.length === 0) {
        setErrore('Nessuna voce riconosciuta: il PDF non sembra un computo Primus.')
        return
      }
      onComputo(estratto, file.name)
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : 'Lettura del PDF non riuscita.')
    } finally {
      setInCorso(false)
    }
  }

  const integrita = computo ? verificaIntegrita(computo) : null

  return (
    <div className="mb-5 rounded-lg border border-border-warm bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-accent">
        <FileText size={16} />
        <span className="text-[11px] font-bold uppercase tracking-wide">Computo metrico</span>
      </div>
      <p className="mb-3 text-sm text-text-secondary">
        Il PDF resta nel browser: non viene caricato da nessuna parte.
      </p>

      <label
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
                    border-border-warm px-6 py-8 text-sm text-text-secondary
                    ${inCorso ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-accent hover:bg-cream'}`}
        onDragOver={(evento) => evento.preventDefault()}
        onDrop={(evento) => {
          evento.preventDefault()
          const file = evento.dataTransfer.files?.[0]
          if (file) void leggi(file)
        }}
      >
        {inCorso ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {inCorso ? 'Lettura in corso…' : 'Scegli il PDF del computo, o trascinalo qui'}
        <input
          type="file"
          accept="application/pdf,.pdf,.PDF"
          className="sr-only"
          disabled={inCorso}
          onChange={(evento) => {
            const file = evento.target.files?.[0]
            evento.target.value = ''
            if (file) void leggi(file)
          }}
        />
      </label>

      {errore && (
        <div className="mt-4">
          <Alert variant="errore">{errore}</Alert>
        </div>
      )}

      {computo && integrita && (
        <div className="mt-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato etichetta="File" valore={nomeFile ?? '—'} />
            <Dato etichetta="Voci lette" valore={String(computo.voci.length)} />
            <Dato etichetta="Categorie" valore={String(Object.keys(computo.riepilogo).length)} />
            <Dato etichetta="Totale computo" valore={formattaEuro(computo.totale)} />
          </dl>

          {integrita.coerente ? (
            <p
              role="status"
              className="mt-4 rounded-md border border-emerald-600/30 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-700"
            >
              Verifica superata: la somma delle voci pareggia il riepilogo (
              {formattaEuro(integrita.totaleVoci)}).
            </p>
          ) : (
            <div className="mt-4">
              <Alert variant="errore">
                Le voci sommano {formattaEuro(integrita.totaleVoci)} contro{' '}
                {formattaEuro(integrita.totaleRiepilogo)} del riepilogo: il computo è stato letto
                male.
              </Alert>
            </div>
          )}

          <table className="mt-6 w-full text-sm">
            <caption className="pb-2 text-left text-[11px] font-bold uppercase tracking-wide text-accent">
              Riepilogo strutturale, come nel computo
            </caption>
            <tbody>
              {Object.entries(computo.riepilogo).map(([codice, categoria]) => (
                <tr key={codice} className="border-b border-border-warm/60 last:border-0">
                  <td className="py-2 font-mono text-xs text-text-secondary">{codice}</td>
                  <td className="py-2 text-text">{categoria.nome}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-text">
                    {formattaEuro(categoria.importo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Dato({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{etichetta}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-text">{valore}</dd>
    </div>
  )
}
