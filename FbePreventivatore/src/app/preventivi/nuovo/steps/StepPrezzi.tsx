import { useMemo } from 'react'
import { CATALOGO_VOCI } from '@/domain/voci'
import { eseguiCalcolo, PASSO_ARROTONDAMENTO_DEFAULT } from '@/domain/calcolo'
import { formattaImportoItaliano } from '@/documento/preview/formattazione'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import { CampoNumerico } from '../../ui/CampoNumerico'
import { arrotondaTotaleAttivo, inputCalcoloDaStato, totaleManualeAttivo, type StatoForm } from '../stato-form'

const PASSI_ARROTONDAMENTO = [100, 500, 1000, 5000, 10000]

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

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

export function StepPrezzi({ stato, aggiorna }: Props) {
  const manuale = totaleManualeAttivo(stato)
  const arrotonda = arrotondaTotaleAttivo(stato)
  const passo = stato.passoArrotondamento ?? PASSO_ARROTONDAMENTO_DEFAULT
  const risultato = useMemo(() => eseguiCalcolo(inputCalcoloDaStato(stato)), [stato])

  return (
    <Section title="Prezzi">
      <Section title="Override voci di listino">
        <div className="grid grid-cols-3 gap-x-4">
          {CATALOGO_VOCI.map((voce) => (
            <Field key={voce.id} label={voce.id}>
              <input
                className={controlClassName}
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
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Totale">
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={manuale}
            onChange={(e) =>
              // passando a manuale si parte dal totale appena calcolato, non da 0
              aggiorna(e.target.checked ? { totaleManuale: true, totaleTarget: risultato.totaleNetto } : { totaleManuale: false })
            }
          />
          Imposta il totale a mano
        </label>
        {manuale ? (
          <Field label="Totale target (per risoluzione arrotondamento)">
            <CampoNumerico
              valore={stato.totaleTarget}
              onCambia={(v) => aggiorna({ totaleTarget: v })}
            />
          </Field>
        ) : (
          <>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="arrotonda-totale"
                checked={arrotonda}
                onChange={(e) => aggiorna({ arrotondaTotale: e.target.checked })}
              />
              Arrotonda il totale per difetto
            </label>
            <div className="grid grid-cols-2 gap-x-4">
              {arrotonda && (
                <Field label="Arrotonda il totale per difetto a">
                  <select
                    className={controlClassName}
                    value={passo}
                    onChange={(e) => aggiorna({ passoArrotondamento: Number(e.target.value) })}
                  >
                    {PASSI_ARROTONDAMENTO.map((p) => (
                      <option key={p} value={p}>
                        {formattaImportoItaliano(p)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={arrotonda ? 'Totale calcolato' : 'Totale calcolato (effettivo, non arrotondato)'}>
                <output data-testid="totale-calcolato" className={`${controlClassName} block bg-transparent`}>
                  {formattaImportoItaliano(risultato.totaleNetto)}
                </output>
              </Field>
            </div>
          </>
        )}
        <p className="text-xs text-text-secondary">
          Arrotondamento {manuale ? 'risolto dal totale digitato' : 'calcolato'}:{' '}
          {formattaImportoItaliano(-risultato.arrotondamento)}
        </p>
      </Section>

      <Section title="Sicurezza">
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Costo dichiarato">
            <CampoNumerico
              valore={stato.sicurezza.costoDichiarato}
              onCambia={(v) => aggiorna({ sicurezza: { ...stato.sicurezza, costoDichiarato: v } })}
            />
          </Field>
          <Field label="Valorizzata (importo oppure OMAGGIO)">
            <input
              className={controlClassName}
              value={formattaValorizzataSicurezza(stato.sicurezza.valorizzata)}
              onChange={(e) => {
                const valore = parseValorizzataSicurezza(e.target.value)
                if (valore !== undefined) aggiorna({ sicurezza: { ...stato.sicurezza, valorizzata: valore } })
              }}
            />
          </Field>
        </div>
      </Section>
    </Section>
  )
}
