import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepAnagrafica({ stato, aggiorna }: Props) {
  return (
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
        <input
          value={stato.cliente.provincia}
          onChange={(e) => aggiorna({ cliente: { ...stato.cliente, provincia: e.target.value } })}
        />
      </label>
      <label>
        Protocollo
        <input value={stato.protocollo} onChange={(e) => aggiorna({ protocollo: e.target.value })} />
      </label>
      <label>
        Progettista
        <input value={stato.progettista} onChange={(e) => aggiorna({ progettista: e.target.value })} />
      </label>
      <label>
        Oggetto
        <input value={stato.oggetto} onChange={(e) => aggiorna({ oggetto: e.target.value })} />
      </label>
      <label>
        Data
        <input type="date" value={stato.data} onChange={(e) => aggiorna({ data: e.target.value })} />
      </label>
      <label>
        Luogo
        <input value={stato.luogo} onChange={(e) => aggiorna({ luogo: e.target.value })} />
      </label>
    </fieldset>
  )
}
