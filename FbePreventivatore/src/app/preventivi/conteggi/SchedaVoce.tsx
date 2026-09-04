'use client'

import { useState } from 'react'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'
import { formattaEuro, formattaQuantita } from './formatta'

interface Props {
  voce: VoceConteggiata
  numero: string
  onOverride: (idMaster: string, importo: number) => void
  onRipristina: (idMaster: string) => void
}

const ETICHETTA_PROVENIENZA: Record<VoceConteggiata['provenienza'], string> = {
  calcolato: 'calcolato dal computo',
  manuale: 'corretto a mano',
  fisso: 'importo fisso',
}

/**
 * Le pareti strutturali assorbono il pareggio (vedi `eseguiConteggio`): il loro
 * importo è determinato per costruzione da tutte le altre voci, e un override
 * verrebbe comunque rifiutato con un avviso. L'interfaccia non propone il campo.
 */
const ID_PARETI = 'pareti-mhm'

export function SchedaVoce({ voce, numero, onOverride, onRipristina }: Props) {
  const [bozza, setBozza] = useState('')

  const manuale = voce.provenienza === 'manuale'
  const correggibile = voce.provenienza !== 'fisso' && voce.idMaster !== ID_PARETI

  return (
    <article
      className={`rounded-lg border bg-white ${
        manuale ? 'border-warning/30 ring-1 ring-warning/10' : 'border-border-warm'
      }`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border-warm px-4 py-3">
        <span className="rounded bg-accent px-2 py-0.5 font-mono text-xs font-semibold text-white">
          {numero}
        </span>
        <h3 className="flex-1 text-sm font-semibold text-text">{voce.descrizione}</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            manuale ? 'bg-warning/10 text-warning' : 'bg-cream text-text-secondary'
          }`}
        >
          {ETICHETTA_PROVENIENZA[voce.provenienza]}
        </span>
      </header>

      {voce.passaggi.length > 0 && (
        <table className="w-full text-sm">
          <caption className="sr-only">Passaggi di calcolo di {voce.descrizione}</caption>
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              <th scope="col" className="px-4 py-2 text-left font-bold">
                Passaggio
              </th>
              <th scope="col" className="py-2 text-left font-bold">
                Fonte
              </th>
              <th scope="col" className="px-4 py-2 text-right font-bold">
                Valore
              </th>
            </tr>
          </thead>
          <tbody>
            {voce.passaggi.map((passaggio, indice) => (
              <tr key={indice} className="border-t border-border-warm/60">
                <td className="px-4 py-2 text-text">{passaggio.etichetta}</td>
                <td className="py-2 font-mono text-xs text-text-secondary">
                  {passaggio.origine.tariffa ?? passaggio.origine.categoria ?? ''}
                  {passaggio.origine.numeroVoce ? ` · voce ${passaggio.origine.numeroVoce}` : ''}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-text">
                  {passaggio.unita === 'eur'
                    ? formattaEuro(passaggio.valore)
                    : formattaQuantita(passaggio.valore, passaggio.unita)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border-warm bg-cream px-4 py-3">
        <code className="text-xs text-text-secondary">{voce.formula}</code>
        <div className="flex items-center gap-3">
          <span className="font-mono text-base font-semibold tabular-nums text-text">
            {typeof voce.importo === 'number' ? formattaEuro(voce.importo) : voce.importo}
          </span>

          {correggibile && (
            <>
              <label className="sr-only" htmlFor={`correggi-${voce.idMaster}`}>
                Correggi l&apos;importo di {voce.descrizione}
              </label>
              <input
                id={`correggi-${voce.idMaster}`}
                inputMode="decimal"
                placeholder="correggi"
                value={bozza}
                onChange={(evento) => setBozza(evento.target.value)}
                onBlur={() => {
                  const valore = Number.parseFloat(bozza.replace(/\s/g, '').replace(',', '.'))
                  if (Number.isFinite(valore)) onOverride(voce.idMaster, valore)
                  setBozza('')
                }}
                className="w-28 rounded-md border border-border-warm bg-cream px-2 py-1 text-right
                           text-sm text-text tabular-nums focus:border-accent focus:bg-white
                           focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              {manuale && (
                <button
                  type="button"
                  onClick={() => onRipristina(voce.idMaster)}
                  className="rounded px-2 py-1 text-xs text-text-secondary underline
                             hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  ripristina
                </button>
              )}
            </>
          )}

          {!correggibile && voce.provenienza !== 'fisso' && (
            <span className="text-xs text-text-secondary">
              assorbe il pareggio: correggi le altre voci
            </span>
          )}
        </div>
      </footer>
    </article>
  )
}
