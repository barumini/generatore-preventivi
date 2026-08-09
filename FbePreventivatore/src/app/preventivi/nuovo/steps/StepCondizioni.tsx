import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepCondizioni({ stato, aggiorna }: Props) {
  return (
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
              onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { percentuale: Number(e.target.value) / 100 }) })}
            />
          </label>
          <label>
            Causale
            <input value={sconto.causale} onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { causale: e.target.value }) })} />
          </label>
          <button type="button" onClick={() => aggiorna({ sconti: rimuoviRiga(stato.sconti, i) })}>
            Rimuovi
          </button>
        </div>
      ))}
      <button type="button" onClick={() => aggiorna({ sconti: [...stato.sconti, { percentuale: 0, causale: '' }] })}>
        Aggiungi sconto
      </button>
    </fieldset>
  )
}
