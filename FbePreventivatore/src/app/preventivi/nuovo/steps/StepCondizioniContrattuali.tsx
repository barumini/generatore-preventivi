import { Plus, Trash2 } from 'lucide-react'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import { CampoNumerico } from '../../ui/CampoNumerico'
import { Button } from '../../ui/Button'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'
import type { VoceEsclusioneForm, VoceOptionalForm } from '@/documento/condizioni-default'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

function lettera(indice: number, maiuscola: boolean): string {
  return `${String.fromCharCode((maiuscola ? 65 : 97) + indice)})`
}

// Stesso principio di StepPrezzi.parseValoreOverride: un valore numerico in formato
// italiano (virgola decimale) diventa number, altrimenti resta la stringa letterale
// digitata (es. "€ 35,00/ora", importo testuale non enumerabile — spec §1).
function parseImportoLibero(testo: string): number | string {
  const pulito = testo.trim()
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? pulito : numero
}

export function StepCondizioniContrattuali({ stato, aggiorna }: Props) {
  const condizioni = stato.condizioni

  function aggiornaCondizioni(parziale: Partial<StatoForm['condizioni']>) {
    aggiorna({ condizioni: { ...condizioni, ...parziale } })
  }

  return (
    <Section title="Condizioni contrattuali">
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Consegna">
          <input className={controlClassName} value={condizioni.consegna} onChange={(e) => aggiornaCondizioni({ consegna: e.target.value })} />
        </Field>
        <Field label="Caparra">
          <CampoNumerico
            valore={condizioni.caparra}
            onCambia={(v) => aggiornaCondizioni({ caparra: v })}
          />
        </Field>
        <Field label="Validità offerta">
          <input className={controlClassName} value={condizioni.validita} onChange={(e) => aggiornaCondizioni({ validita: e.target.value })} />
        </Field>
      </div>

      <Section title="SAL">
        {condizioni.sal.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <div className="w-24">
              <Field label="%">
                <CampoNumerico
                  valore={riga.percentuale * 100}
                  onCambia={(v) => aggiornaCondizioni({ sal: aggiornaRiga(condizioni.sal, i, { percentuale: v / 100 }) })}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Descrizione">
                <input
                  className={controlClassName}
                  value={riga.descrizione}
                  onChange={(e) => aggiornaCondizioni({ sal: aggiornaRiga(condizioni.sal, i, { descrizione: e.target.value }) })}
                />
              </Field>
            </div>
            <Button type="button" variant="ghost" aria-label="Rimuovi SAL" onClick={() => aggiornaCondizioni({ sal: rimuoviRiga(condizioni.sal, i) })} className="mb-3">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => aggiornaCondizioni({ sal: [...condizioni.sal, { percentuale: 0, descrizione: '' }] })}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi SAL
          </span>
        </Button>
      </Section>

      <Section title="Optional">
        {condizioni.optional.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <span className="mb-3 w-6 text-sm font-semibold text-text-secondary">{lettera(i, true)}</span>
            <div className="flex-1">
              <Field label="Descrizione">
                <input
                  className={controlClassName}
                  value={riga.descrizione}
                  onChange={(e) => aggiornaCondizioni({ optional: aggiornaRiga(condizioni.optional, i, { descrizione: e.target.value }) })}
                />
              </Field>
            </div>
            <div className="w-40">
              <Field label="Importo">
                <input
                  className={controlClassName}
                  value={String(riga.importo)}
                  onChange={(e) => aggiornaCondizioni({ optional: aggiornaRiga(condizioni.optional, i, { importo: parseImportoLibero(e.target.value) }) })}
                />
              </Field>
            </div>
            <label className="mb-3 flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={riga.praticaGenioCivile ?? false}
                onChange={(e) => {
                  const marcata = e.target.checked
                  // Al più una riga marcata alla volta (spec §1): marcare questa smarca le altre.
                  aggiornaCondizioni({ optional: condizioni.optional.map((v, idx) => ({ ...v, praticaGenioCivile: idx === i ? marcata : false })) })
                }}
              />
              Pratica Genio Civile
            </label>
            <Button type="button" variant="ghost" aria-label="Rimuovi optional" onClick={() => aggiornaCondizioni({ optional: rimuoviRiga(condizioni.optional, i) })} className="mb-3">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => aggiornaCondizioni({ optional: [...condizioni.optional, { descrizione: '', importo: '' } satisfies VoceOptionalForm] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi optional
          </span>
        </Button>
      </Section>

      <Section title="Esclusioni">
        {condizioni.esclusioni.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <span className="mb-3 w-6 text-sm font-semibold text-text-secondary">{lettera(i, false)}</span>
            <div className="flex-1">
              <Field label="Descrizione">
                <input
                  className={controlClassName}
                  value={riga.descrizione}
                  onChange={(e) => aggiornaCondizioni({ esclusioni: aggiornaRiga(condizioni.esclusioni, i, { descrizione: e.target.value }) })}
                />
              </Field>
            </div>
            <div className="w-40">
              <Field label="Importo">
                <input
                  className={controlClassName}
                  value={String(riga.importo)}
                  onChange={(e) => aggiornaCondizioni({ esclusioni: aggiornaRiga(condizioni.esclusioni, i, { importo: parseImportoLibero(e.target.value) }) })}
                />
              </Field>
            </div>
            <Button type="button" variant="ghost" aria-label="Rimuovi esclusione" onClick={() => aggiornaCondizioni({ esclusioni: rimuoviRiga(condizioni.esclusioni, i) })} className="mb-3">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => aggiornaCondizioni({ esclusioni: [...condizioni.esclusioni, { descrizione: '', importo: '' } satisfies VoceEsclusioneForm] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi esclusione
          </span>
        </Button>
      </Section>
    </Section>
  )
}
