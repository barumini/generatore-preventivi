'use client'

import { useMemo, useState } from 'react'
import { CaricamentoComputo } from './CaricamentoComputo'
import { SchedaVoce } from './SchedaVoce'
import { Riconciliazione } from './Riconciliazione'
import { Alert } from '../ui/Alert'
import { Breadcrumb } from '../ui/Breadcrumb'
import { eseguiConteggio } from '@/domain/computo/conteggio'
import type { Computo } from '@/domain/computo/estrai-voci'

/**
 * Numeri di riga del foglio Conteggi Master, per id stabile — vincolo CLAUDE.md #4:
 * si calcolano al render sulle voci incluse, mai memorizzati sulla voce stessa.
 */
export const NUMERO_MASTER: Record<string, string> = {
  'pareti-mhm': '1',
  'tracciamento-impianti': '1.a',
  'pareti-telaio': '1.b',
  'trave-larice': '1.c',
  'solaio-interpiano': '2',
  'copertura-falda': '3',
  'copertura-piana': '3.a',
  cappotto: '4',
  'cartongesso-q2': '5',
  'assistenza-cartongessisti': '5.a',
  'infissi-pvc': '6',
  monoblocchi: '6.a',
  'progettazione-esecutiva': '7',
}

export default function PaginaConteggi() {
  const [computo, setComputo] = useState<Computo | null>(null)
  const [nomeFile, setNomeFile] = useState<string | null>(null)
  const [override, setOverride] = useState<Record<string, number>>({})

  const esito = useMemo(
    () => (computo ? eseguiConteggio(computo, override) : null),
    [computo, override],
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <Breadcrumb
        voci={[
          { label: 'Home', href: '/' },
          { label: 'Preventivi', href: '/preventivi' },
          { label: 'Conteggi da computo' },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-lg font-bold text-text">Conteggi da computo metrico</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Ricava gli importi delle voci dell&apos;offerta dal computo Primus, mostrando ogni
          passaggio. Non modifica i preventivi esistenti.
        </p>
      </div>

      <CaricamentoComputo
        computo={computo}
        nomeFile={nomeFile}
        onComputo={(estratto, nome) => {
          setComputo(estratto)
          setNomeFile(nome)
          setOverride({})
        }}
      />

      {esito && (
        <>
          {esito.avvisi.length > 0 && (
            <ul className="mt-6 space-y-2">
              {esito.avvisi.map((avviso, indice) => (
                <li key={`${avviso.codice}-${indice}`}>
                  <Alert variant={avviso.livello === 'errore' ? 'errore' : 'avviso'}>
                    {avviso.messaggio}
                  </Alert>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-text">Passaggi</h2>
            <div className="flex flex-col gap-4">
              {esito.voci.map((voce) => (
                <SchedaVoce
                  key={voce.idMaster}
                  voce={voce}
                  numero={NUMERO_MASTER[voce.idMaster] ?? ''}
                  onOverride={(id, importo) => setOverride((precedente) => ({ ...precedente, [id]: importo }))}
                  onRipristina={(id) =>
                    setOverride((precedente) => {
                      const successivo = { ...precedente }
                      delete successivo[id]
                      return successivo
                    })
                  }
                />
              ))}
            </div>
          </div>

          <Riconciliazione
            esito={esito}
            totaleComputo={computo!.totale}
            numeroMaster={NUMERO_MASTER}
          />
        </>
      )}
    </div>
  )
}
