import { Plus, Trash2 } from 'lucide-react'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import { CampoNumerico } from '../../ui/CampoNumerico'
import { Button } from '../../ui/Button'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepCondizioni({ stato, aggiorna }: Props) {
  return (
    <Section title="Condizioni">
      <Section title="Sconti a cascata">
        {stato.sconti.map((sconto, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <div className="flex-1">
              <Field label="Percentuale (%)">
                <CampoNumerico
                  valore={sconto.percentuale * 100}
                  onCambia={(v) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { percentuale: v / 100 }) })}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Causale">
                <input
                  className={controlClassName}
                  value={sconto.causale}
                  onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { causale: e.target.value }) })}
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Rimuovi sconto"
              onClick={() => aggiorna({ sconti: rimuoviRiga(stato.sconti, i) })}
              className="mb-3"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => aggiorna({ sconti: [...stato.sconti, { percentuale: 0, causale: '' }] })}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi sconto
          </span>
        </Button>
      </Section>
    </Section>
  )
}
