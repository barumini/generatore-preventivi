import type { LivelloModulo, Modulo } from '@/domain/voci'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

const LIVELLI_MODULO: LivelloModulo[] = ['completo', 'impoverito', 'escluso']
const MODULI: { chiave: Modulo; etichetta: string }[] = [
  { chiave: 'struttura', etichetta: 'Struttura' },
  { chiave: 'involucro', etichetta: 'Involucro' },
  { chiave: 'finiture', etichetta: 'Finiture' },
]

export function StepConfigurazione({ stato, aggiorna }: Props) {
  return (
    <fieldset>
      <legend>Configurazione</legend>
      {MODULI.map(({ chiave, etichetta }) => (
        <label key={chiave}>
          {etichetta}
          <select
            value={stato.livelli[chiave]}
            onChange={(e) => aggiorna({ livelli: { ...stato.livelli, [chiave]: e.target.value as LivelloModulo } })}
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
  )
}
