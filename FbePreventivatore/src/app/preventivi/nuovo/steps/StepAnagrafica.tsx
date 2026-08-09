import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepAnagrafica({ stato, aggiorna }: Props) {
  return (
    <Section title="Anagrafica">
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Cliente">
          <input
            className={controlClassName}
            value={stato.cliente.nome}
            onChange={(e) => aggiorna({ cliente: { ...stato.cliente, nome: e.target.value } })}
          />
        </Field>
        <Field label="Protocollo">
          <input className={controlClassName} value={stato.protocollo} onChange={(e) => aggiorna({ protocollo: e.target.value })} />
        </Field>
        <Field label="Comune">
          <input
            className={controlClassName}
            value={stato.cliente.comune}
            onChange={(e) => aggiorna({ cliente: { ...stato.cliente, comune: e.target.value } })}
          />
        </Field>
        <Field label="Provincia">
          <input
            className={controlClassName}
            value={stato.cliente.provincia}
            onChange={(e) => aggiorna({ cliente: { ...stato.cliente, provincia: e.target.value } })}
          />
        </Field>
        <Field label="Progettista">
          <input className={controlClassName} value={stato.progettista} onChange={(e) => aggiorna({ progettista: e.target.value })} />
        </Field>
        <Field label="Oggetto">
          <input className={controlClassName} value={stato.oggetto} onChange={(e) => aggiorna({ oggetto: e.target.value })} />
        </Field>
        <Field label="Data">
          <input type="date" className={controlClassName} value={stato.data} onChange={(e) => aggiorna({ data: e.target.value })} />
        </Field>
        <Field label="Luogo">
          <input className={controlClassName} value={stato.luogo} onChange={(e) => aggiorna({ luogo: e.target.value })} />
        </Field>
      </div>
    </Section>
  )
}
