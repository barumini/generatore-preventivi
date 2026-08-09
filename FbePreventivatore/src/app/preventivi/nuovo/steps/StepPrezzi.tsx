import { CATALOGO_VOCI } from '@/domain/voci'
import type { StatoForm } from '../stato-form'

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
  return (
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
        <input type="number" value={stato.totaleTarget} onChange={(e) => aggiorna({ totaleTarget: Number(e.target.value) })} />
      </label>
      <h4>Sicurezza</h4>
      <label>
        Costo dichiarato
        <input
          type="number"
          value={stato.sicurezza.costoDichiarato}
          onChange={(e) => aggiorna({ sicurezza: { ...stato.sicurezza, costoDichiarato: Number(e.target.value) } })}
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
  )
}
