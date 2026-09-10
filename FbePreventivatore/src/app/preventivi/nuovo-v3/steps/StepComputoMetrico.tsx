'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CaricamentoComputo } from '../../conteggi/CaricamentoComputo'
import { SchedaVoce } from '../../conteggi/SchedaVoce'
import { NUMERO_MASTER } from '../../conteggi/page'
import { formattaEuro } from '../../conteggi/formatta'
import { Alert } from '../../ui/Alert'
import { Section } from '../../ui/Section'
import { eseguiConteggio, COSTI_SICUREZZA_FORFETTARI, type RisultatoConteggio } from '@/domain/computo/conteggio'
import type { Computo } from '@/domain/computo/estrai-voci'
import { numeroPianiAbitativi, superficieGarage } from '@/domain/geometria'
import type { ConfigurazioneVoci } from '@/domain/voci'
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
  const [vociEscluse, setVociEscluse] = useState<string[]>([])
  const [idApplicati, setIdApplicati] = useState<string[]>([])

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
  // produce. L'aggiornamento vive in un useEffect (non nel corpo del componente) per lo
  // stesso motivo dietro il fix di questo file in Task 2: scrivere un ref durante il
  // render è un errore ESLint reale (react-hooks/refs), non solo uno stile diverso.
  const overridesAttuali = useRef(stato.overrides)
  useEffect(() => {
    overridesAttuali.current = stato.overrides
  })

  // La configurazione corrente decide quali voci del catalogo compaiono nel preventivo
  // (StepConfigurazione, StepGeometria): un importo dal conteggio per una voce esclusa
  // non deve entrare in overrides, altrimenti resterebbe nella somma di controllo di
  // questo step senza comparire nel Listino reale. Stesso pattern di ref-in-effect del
  // blocco sopra, stesso motivo.
  const configurazioneRef = useRef<ConfigurazioneVoci>({
    livelli: stato.livelli,
    numeroPianiAbitativi: numeroPianiAbitativi(stato.superfici),
    superficieGarage: superficieGarage(stato.superfici),
    chiaviInManoNelTotale: stato.chiaviInManoNelTotale,
  })
  useEffect(() => {
    configurazioneRef.current = {
      livelli: stato.livelli,
      numeroPianiAbitativi: numeroPianiAbitativi(stato.superfici),
      superficieGarage: superficieGarage(stato.superfici),
      chiaviInManoNelTotale: stato.chiaviInManoNelTotale,
    }
  })

  useEffect(() => {
    if (!esito) return
    const risultato = mappaConteggioAOverride(esito.voci, overridesAttuali.current, configurazioneRef.current)
    aggiorna({ overrides: risultato.overrides })
    setVociScartate(risultato.vociScartate)
    setVociEscluse(risultato.vociEscluseDallaConfigurazione)
    setIdApplicati(
      esito.voci
        .map((voce) => voce.idMaster)
        .filter(
          (id) => !risultato.vociScartate.includes(id) && !risultato.vociEscluseDallaConfigurazione.includes(id),
        ),
    )
  }, [esito, aggiorna])

  return (
    <Section title="Computo metrico">
      <p className="mb-4 text-sm text-text-secondary">
        Carica il computo Primus del progetto: gli importi delle voci coperte dal
        conteggio sovrascrivono la proposta del listino parametrico. Le voci non coperte
        dal conteggio (es. garage) restano quelle impostate nello step &quot;Prezzi&quot;.
        &quot;Ripristina&quot; su una scheda qui sotto annulla solo la correzione manuale
        fatta in questa pagina, riportando la voce al valore calcolato dal conteggio — non
        rimuove l&apos;importo dal preventivo. Per rimuovere del tutto un importo arrivato
        dal conteggio, cancella il campo corrispondente nello step &quot;Prezzi&quot;.
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

      {idApplicati.length > 0 && (
        <div className="mt-4">
          <Alert variant="avviso">
            Questo conteggio sta impostando gli importi di: {idApplicati.join(', ')}. Se
            correggi uno di questi valori nello step &quot;Prezzi&quot;, ricaricare un
            computo lo sovrascriverà di nuovo.
          </Alert>
        </div>
      )}

      {erroreConteggio && <Alert variant="errore">{erroreConteggio}</Alert>}

      {vociScartate.length > 0 && (
        <div className="mt-4">
          <Alert variant="avviso">
            Queste voci del computo non hanno una voce corrispondente nel catalogo
            attuale e non sono state applicate al preventivo: {vociScartate.join(', ')}.
          </Alert>
        </div>
      )}

      {vociEscluse.length > 0 && (
        <div className="mt-4">
          <Alert variant="avviso">
            Queste voci del computo sono nel catalogo ma escluse dalla configurazione
            attuale (Configurazione/Geometria): il loro importo non è entrato nel
            preventivo: {vociEscluse.join(', ')}.
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
                  // Rimuove solo la correzione locale (overrideLocali): la voce torna
                  // al valore calcolato dalle regole del conteggio, non al comportamento
                  // di default di eseguiCalcolo (driver da geometria). Per quello serve
                  // cancellare il campo in StepPrezzi — vedi il paragrafo introduttivo.
                  setOverrideLocali((precedente) => {
                    const successivo = { ...precedente }
                    delete successivo[id]
                    return successivo
                  })
                }
              />
            ))}
          </div>

          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-text">Riepilogo del conteggio</h2>
            <p className="mb-3 text-sm text-text-secondary">
              Il totale commerciale (sconti, arrotondamento) è quello dell&apos;anteprima
              a destra: qui sotto solo la riconciliazione fra le voci conteggiate e il
              totale del computo.
            </p>
            <div className="rounded-lg border border-border-warm bg-white">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Riconciliazione fra le voci conteggiate e il totale del computo
                </caption>
                <tbody>
                  <tr className="border-b border-border-warm/60">
                    <td className="px-5 py-3 text-text">Somma delle voci conteggiate</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-text">
                      {formattaEuro(esito.sommaVoci)}
                    </td>
                  </tr>
                  <tr className="border-b border-border-warm/60">
                    <td className="px-5 py-3 text-text">
                      Totale computo − {formattaEuro(COSTI_SICUREZZA_FORFETTARI)} di sicurezza
                      <span className="ml-2 text-xs text-text-secondary">
                        da {formattaEuro(computo!.totale)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-text">
                      {formattaEuro(esito.target)}
                    </td>
                  </tr>
                  <tr className="bg-cream">
                    <td className="px-5 py-3 font-semibold text-text">
                      Delta caricato sulle pareti strutturali
                      <span className="ml-2 text-xs text-text-secondary">
                        {formattaEuro(esito.target)} − {formattaEuro(esito.sommaVoci)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-text">
                      {formattaEuro(esito.delta)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Section>
  )
}
