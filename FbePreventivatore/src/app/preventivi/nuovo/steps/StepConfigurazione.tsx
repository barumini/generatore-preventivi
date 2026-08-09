import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
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
    <Section title="Configurazione">
      <div className="grid grid-cols-3 gap-x-4">
        {MODULI.map(({ chiave, etichetta }) => (
          <Field key={chiave} label={etichetta}>
            <select
              className={controlClassName}
              value={stato.livelli[chiave]}
              onChange={(e) => aggiorna({ livelli: { ...stato.livelli, [chiave]: e.target.value as LivelloModulo } })}
            >
              {LIVELLI_MODULO.map((livello) => (
                <option key={livello} value={livello}>
                  {livello}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={stato.chiaviInManoNelTotale}
          onChange={(e) => aggiorna({ chiaviInManoNelTotale: e.target.checked })}
          className="h-4 w-4 rounded border-border-warm text-accent focus:ring-accent/30"
        />
        Chiavi in mano nel totale
      </label>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Copertura">
          <select
            className={controlClassName}
            value={stato.caratteristiche.copertura}
            onChange={(e) =>
              aggiorna({ caratteristiche: { ...stato.caratteristiche, copertura: e.target.value as 'falde' | 'piano' } })
            }
          >
            <option value="falde">A falde</option>
            <option value="piano">Piano</option>
          </select>
        </Field>
        <Field label="Manto di copertura">
          <input
            className={controlClassName}
            value={stato.caratteristiche.manto}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, manto: e.target.value } })}
          />
        </Field>
        <Field label="Finitura esterna">
          <select
            className={controlClassName}
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
        </Field>
        <Field label="Tetto (descrizione)">
          <input
            className={controlClassName}
            value={stato.caratteristiche.tetto}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, tetto: e.target.value } })}
          />
        </Field>
      </div>
    </Section>
  )
}
