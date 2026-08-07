// src/app/preventivi/nuovo/FormStrutturato.tsx
'use client'

import { useState } from 'react'
import { totaleSuperficiLorde, PIANI_CANONICI, CATEGORIE_SERRAMENTO, type CategoriaSerramento, type Serramento, type SuperficiePiano } from '@/domain/geometria'
import { CATALOGO_VOCI, type LivelloModulo, type Modulo } from '@/domain/voci'
import type { StatoForm } from './stato-form'

const STATO_INIZIALE: StatoForm = {
  cliente: { nome: '', comune: '', provincia: '' },
  protocollo: '',
  superfici: [],
  serramenti: [],
  perimetro: 0,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  chiaviInManoNelTotale: false,
  sconti: [],
  overrides: {},
  totaleTarget: 0,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: { copertura: 'falde', manto: 'Tegole in cemento', finituraEsterna: 'intonaco', tetto: 'Tetto con travi e perline in abete' },
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  onCambiamento: (stato: StatoForm) => void
}

const LIVELLI_MODULO: LivelloModulo[] = ['completo', 'impoverito', 'escluso']
const MODULI: { chiave: Modulo; etichetta: string }[] = [
  { chiave: 'struttura', etichetta: 'Struttura' },
  { chiave: 'involucro', etichetta: 'Involucro' },
  { chiave: 'finiture', etichetta: 'Finiture' },
]

const VALORI_TESTUALI_OVERRIDE = ['comprese', 'escluso', 'escluse', 'OMAGGIO'] as const
type ValoreTestualeOverride = (typeof VALORI_TESTUALI_OVERRIDE)[number]

function parseValoreOverride(testo: string): number | ValoreTestualeOverride | undefined {
  const pulito = testo.trim()
  if (pulito === '') return undefined
  if ((VALORI_TESTUALI_OVERRIDE as readonly string[]).includes(pulito)) return pulito as ValoreTestualeOverride
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? undefined : numero
}

function formattaValoreOverride(valore: number | ValoreTestualeOverride | undefined): string {
  if (valore === undefined) return ''
  return String(valore)
}

function parseValorizzataSicurezza(testo: string): number | 'OMAGGIO' | undefined {
  const pulito = testo.trim()
  if (pulito === '') return undefined
  if (pulito === 'OMAGGIO') return 'OMAGGIO'
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? undefined : numero
}

function formattaValorizzataSicurezza(valore: number | 'OMAGGIO'): string {
  return String(valore)
}

function aggiornaRiga<T>(righe: T[], indice: number, parziale: Partial<T>): T[] {
  return righe.map((riga, i) => (i === indice ? { ...riga, ...parziale } : riga))
}

function rimuoviRiga<T>(righe: T[], indice: number): T[] {
  return righe.filter((_, i) => i !== indice)
}

export function FormStrutturato({ statoIniziale, onCambiamento }: Props) {
  const [step, setStep] = useState(0)
  const [stato, setStato] = useState<StatoForm>({ ...STATO_INIZIALE, ...statoIniziale })

  function aggiorna(parziale: Partial<StatoForm>) {
    const nuovo = { ...stato, ...parziale }
    setStato(nuovo)
    onCambiamento(nuovo)
  }

  const STEP_TITOLI = ['Anagrafica', 'Configurazione', 'Geometria', 'Prezzi', 'Condizioni']

  return (
    <div>
      <nav>
        {STEP_TITOLI.map((titolo, i) => (
          <button key={titolo} onClick={() => setStep(i)} aria-current={i === step}>
            {i + 1}. {titolo}
          </button>
        ))}
      </nav>
      {step === 0 && (
        <fieldset>
          <legend>Anagrafica</legend>
          <label>
            Cliente
            <input value={stato.cliente.nome} onChange={(e) => aggiorna({ cliente: { ...stato.cliente, nome: e.target.value } })} />
          </label>
          <label>
            Comune
            <input value={stato.cliente.comune} onChange={(e) => aggiorna({ cliente: { ...stato.cliente, comune: e.target.value } })} />
          </label>
          <label>
            Provincia
            <input value={stato.cliente.provincia} onChange={(e) => aggiorna({ cliente: { ...stato.cliente, provincia: e.target.value } })} />
          </label>
          <label>
            Protocollo
            <input value={stato.protocollo} onChange={(e) => aggiorna({ protocollo: e.target.value })} />
          </label>
        </fieldset>
      )}
      {step === 1 && (
        <fieldset>
          <legend>Configurazione</legend>
          {MODULI.map(({ chiave, etichetta }) => (
            <label key={chiave}>
              {etichetta}
              <select
                value={stato.livelli[chiave]}
                onChange={(e) =>
                  aggiorna({ livelli: { ...stato.livelli, [chiave]: e.target.value as LivelloModulo } })
                }
              >
                {LIVELLI_MODULO.map((livello) => (
                  <option key={livello} value={livello}>
                    {livello}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={stato.chiaviInManoNelTotale}
              onChange={(e) => aggiorna({ chiaviInManoNelTotale: e.target.checked })}
            />
            Chiavi in mano nel totale
          </label>
          <label>
            Copertura
            <select
              value={stato.caratteristiche.copertura}
              onChange={(e) =>
                aggiorna({ caratteristiche: { ...stato.caratteristiche, copertura: e.target.value as 'falde' | 'piano' } })
              }
            >
              <option value="falde">A falde</option>
              <option value="piano">Piano</option>
            </select>
          </label>
          <label>
            Manto di copertura
            <input
              value={stato.caratteristiche.manto}
              onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, manto: e.target.value } })}
            />
          </label>
          <label>
            Finitura esterna
            <select
              value={stato.caratteristiche.finituraEsterna}
              onChange={(e) =>
                aggiorna({
                  caratteristiche: { ...stato.caratteristiche, finituraEsterna: e.target.value as 'intonaco' | 'rivestimento' },
                })
              }
            >
              <option value="intonaco">Intonaco</option>
              <option value="rivestimento">Rivestimento</option>
            </select>
          </label>
          <label>
            Tetto (descrizione)
            <input
              value={stato.caratteristiche.tetto}
              onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, tetto: e.target.value } })}
            />
          </label>
        </fieldset>
      )}
      {step === 2 && (
        <fieldset>
          <legend>Geometria</legend>

          <h4>Superfici per piano</h4>
          {stato.superfici.map((riga, i) => (
            <div key={i}>
              <label>
                Piano
                {/* Il dominio confronta i nomi piano per stringa esatta: un testo libero
                    come "Piano terra" azzererebbe il driver della copertura e farebbe
                    sparire il garage senza avvisi. La lista canonica vive in geometria.ts. */}
                <select
                  value={riga.piano}
                  onChange={(e) => aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { piano: e.target.value }) })}
                >
                  <option value="">— seleziona il piano —</option>
                  {PIANI_CANONICI.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                  {riga.piano !== '' && !(PIANI_CANONICI as readonly string[]).includes(riga.piano) && (
                    // Un nome arrivato dall'estrazione e non riconosciuto resta visibile
                    // e marcato: va corretto a mano, non fatto sparire.
                    <option value={riga.piano}>{riga.piano} — nome non valido, da correggere</option>
                  )}
                </select>
              </label>
              <label>
                Sup. lorda (mq)
                <input
                  value={riga.valoreLordo}
                  onChange={(e) =>
                    aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { valoreLordo: e.target.value }) })
                  }
                />
              </label>
              <button type="button" onClick={() => aggiorna({ superfici: rimuoviRiga(stato.superfici, i) })}>
                Rimuovi
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              aggiorna({ superfici: [...stato.superfici, { piano: '', valoreLordo: '' } satisfies SuperficiePiano] })
            }
          >
            Aggiungi piano
          </button>

          <label>
            Totale superfici lorde calcolato: {totaleSuperficiLorde(stato.superfici)} mq — sovrascrivi (spec §3.9)
            <input
              type="number"
              value={stato.totaleLordoManuale ?? ''}
              placeholder={String(totaleSuperficiLorde(stato.superfici))}
              onChange={(e) =>
                aggiorna({ totaleLordoManuale: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </label>

          <label>
            Perimetro (ml)
            <input
              type="number"
              value={stato.perimetro}
              onChange={(e) => aggiorna({ perimetro: Number(e.target.value) })}
            />
          </label>

          <h4>Serramenti</h4>
          {stato.serramenti.map((riga, i) => (
            <div key={i}>
              <label>
                Piano
                <input
                  value={riga.piano}
                  onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { piano: e.target.value }) })}
                />
              </label>
              <label>
                Tipologia
                <input
                  value={riga.tipologia}
                  onChange={(e) =>
                    aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { tipologia: e.target.value }) })
                  }
                />
              </label>
              <label>
                Categoria
                <select
                  value={riga.categoria}
                  onChange={(e) =>
                    aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { categoria: e.target.value as CategoriaSerramento }) })
                  }
                >
                  {CATEGORIE_SERRAMENTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Base (m)
                <input
                  type="number"
                  value={riga.b}
                  onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { b: Number(e.target.value) }) })}
                />
              </label>
              <label>
                Altezza (m)
                <input
                  type="number"
                  value={riga.h}
                  onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { h: Number(e.target.value) }) })}
                />
              </label>
              <button type="button" onClick={() => aggiorna({ serramenti: rimuoviRiga(stato.serramenti, i) })}>
                Rimuovi
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              aggiorna({
                serramenti: [
                  ...stato.serramenti,
                  { n: stato.serramenti.length + 1, piano: '', tipologia: '', categoria: 'finestra-battente', b: 0, h: 0 } satisfies Serramento,
                ],
              })
            }
          >
            Aggiungi serramento
          </button>
        </fieldset>
      )}
      {step === 3 && (
        <fieldset>
          <legend>Prezzi</legend>
          <h4>Override voci di listino</h4>
          {CATALOGO_VOCI.map((voce) => (
            <label key={voce.id}>
              {voce.id}
              <input
                value={formattaValoreOverride(stato.overrides[voce.id])}
                placeholder="proposto dal listino"
                onChange={(e) => {
                  const valore = parseValoreOverride(e.target.value)
                  const nuoviOverrides = { ...stato.overrides }
                  if (valore === undefined) {
                    delete nuoviOverrides[voce.id]
                  } else {
                    nuoviOverrides[voce.id] = valore
                  }
                  aggiorna({ overrides: nuoviOverrides })
                }}
              />
            </label>
          ))}
          <label>
            Totale target (per risoluzione arrotondamento)
            <input
              type="number"
              value={stato.totaleTarget}
              onChange={(e) => aggiorna({ totaleTarget: Number(e.target.value) })}
            />
          </label>
          <h4>Sicurezza</h4>
          <label>
            Costo dichiarato
            <input
              type="number"
              value={stato.sicurezza.costoDichiarato}
              onChange={(e) =>
                aggiorna({ sicurezza: { ...stato.sicurezza, costoDichiarato: Number(e.target.value) } })
              }
            />
          </label>
          <label>
            Valorizzata (importo oppure OMAGGIO)
            <input
              value={formattaValorizzataSicurezza(stato.sicurezza.valorizzata)}
              onChange={(e) => {
                const valore = parseValorizzataSicurezza(e.target.value)
                if (valore !== undefined) aggiorna({ sicurezza: { ...stato.sicurezza, valorizzata: valore } })
              }}
            />
          </label>
        </fieldset>
      )}
      {step === 4 && (
        <fieldset>
          <legend>Condizioni</legend>
          <h4>Sconti a cascata</h4>
          {stato.sconti.map((sconto, i) => (
            <div key={i}>
              <label>
                Percentuale (%)
                <input
                  type="number"
                  value={sconto.percentuale * 100}
                  onChange={(e) =>
                    aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { percentuale: Number(e.target.value) / 100 }) })
                  }
                />
              </label>
              <label>
                Causale
                <input
                  value={sconto.causale}
                  onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { causale: e.target.value }) })}
                />
              </label>
              <button type="button" onClick={() => aggiorna({ sconti: rimuoviRiga(stato.sconti, i) })}>
                Rimuovi
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => aggiorna({ sconti: [...stato.sconti, { percentuale: 0, causale: '' }] })}
          >
            Aggiungi sconto
          </button>
        </fieldset>
      )}
    </div>
  )
}
