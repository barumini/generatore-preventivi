'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CaricamentoComputo } from '../../conteggi/CaricamentoComputo'
import { SchedaVoce } from '../../conteggi/SchedaVoce'
import { Riconciliazione } from '../../conteggi/Riconciliazione'
import { NUMERO_MASTER } from '../../conteggi/page'
import { Alert } from '../../ui/Alert'
import { Section } from '../../ui/Section'
import { eseguiConteggio, type RisultatoConteggio } from '@/domain/computo/conteggio'
import type { Computo } from '@/domain/computo/estrai-voci'
import { mappaConteggioAOverride } from '../mappa-conteggio'
import type { StatoForm } from '../../nuovo/stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepComputoMetrico({ stato, aggiorna }: Props) {
  const [computo, setComputo] = useState<Computo | null>(null)
  const [nomeFile, setNomeFile] = useState<string | null>(null)
  const [overrideLocali, setOverrideLocali] = useState<Record<string, number>>({})
  const [vociScartate, setVociScartate] = useState<string[]>([])

  // eseguiConteggio può sollevare (voce con tariffa duplicata o mancante: cfr.
  // src/app/preventivi/conteggi/page.tsx), quindi va isolata in un try/catch invece di
  // lasciarla propagare fuori dal render di questo step.
  const { esito, erroreConteggio } = useMemo((): {
    esito: RisultatoConteggio | null
    erroreConteggio: string | null
  } => {
    if (!computo) return { esito: null, erroreConteggio: null }
    try {
      return { esito: eseguiConteggio(computo, overrideLocali), erroreConteggio: null }
    } catch (causa) {
      const messaggio = causa instanceof Error ? causa.message : 'Errore sconosciuto nel conteggio.'
      return { esito: null, erroreConteggio: messaggio }
    }
  }, [computo, overrideLocali])

  // Tiene sempre l'ultimo `stato.overrides` senza farne una dipendenza dell'effetto
  // sotto: l'effetto stesso scrive in `stato.overrides` tramite `aggiorna`, quindi
  // includerlo fra le dipendenze lo farebbe rieseguire a ogni scrittura che lui stesso
  // produce.
  const overridesAttuali = useRef(stato.overrides)

  useEffect(() => {
    overridesAttuali.current = stato.overrides
  })

  useEffect(() => {
    if (!esito) return
    const risultato = mappaConteggioAOverride(esito.voci, overridesAttuali.current)
    aggiorna({ overrides: risultato.overrides })
    setVociScartate(risultato.vociScartate)
  }, [esito, aggiorna])

  return (
    <Section title="Computo metrico">
      <p className="mb-4 text-sm text-text-secondary">
        Carica il computo Primus del progetto: gli importi delle voci coperte dal
        conteggio sovrascrivono la proposta del listino parametrico. Le voci non
        coperte dal conteggio (es. garage) restano quelle impostate nello step
        &quot;Prezzi&quot;.
      </p>

      <CaricamentoComputo
        computo={computo}
        nomeFile={nomeFile}
        onComputo={(estratto, nome) => {
          setComputo(estratto)
          setNomeFile(nome)
          setOverrideLocali({})
        }}
      />

      {erroreConteggio && <Alert variant="errore">{erroreConteggio}</Alert>}

      {vociScartate.length > 0 && (
        <div className="mt-4">
          <Alert variant="avviso">
            Queste voci del computo non hanno una voce corrispondente nel catalogo
            attuale e non sono state applicate al preventivo: {vociScartate.join(', ')}.
          </Alert>
        </div>
      )}

      {esito && (
        <>
          {esito.avvisi.length > 0 && (
            <ul className="mt-4 space-y-2">
              {esito.avvisi.map((avviso, indice) => (
                <li key={`${avviso.codice}-${indice}`}>
                  <Alert variant={avviso.livello === 'errore' ? 'errore' : 'avviso'}>
                    {avviso.messaggio}
                  </Alert>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col gap-4">
            {esito.voci.map((voce) => (
              <SchedaVoce
                key={voce.idMaster}
                voce={voce}
                numero={NUMERO_MASTER[voce.idMaster] ?? ''}
                onOverride={(id, importo) =>
                  setOverrideLocali((precedente) => ({ ...precedente, [id]: importo }))
                }
                onRipristina={(id) =>
                  setOverrideLocali((precedente) => {
                    const successivo = { ...precedente }
                    delete successivo[id]
                    return successivo
                  })
                }
              />
            ))}
          </div>

          <Riconciliazione esito={esito} totaleComputo={computo!.totale} numeroMaster={NUMERO_MASTER} />
        </>
      )}
    </Section>
  )
}
