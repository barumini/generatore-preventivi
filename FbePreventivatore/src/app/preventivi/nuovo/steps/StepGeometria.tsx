import { Plus, Trash2 } from 'lucide-react'
import {
  totaleSuperficiLorde,
  suggerisciTotaleLordoTesto,
  PIANI_CANONICI,
  CATEGORIE_SERRAMENTO,
  type CategoriaSerramento,
  type Serramento,
  type SuperficiePiano,
} from '@/domain/geometria'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import { Button } from '../../ui/Button'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepGeometria({ stato, aggiorna }: Props) {
  return (
    <Section title="Geometria">
      <Section title="Superfici per piano">
        {stato.superfici.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <div className="flex-1">
              <Field label="Piano">
                {/* Il dominio confronta i nomi piano per stringa esatta: un testo libero
                    come "Piano terra" azzererebbe il driver della copertura e farebbe
                    sparire il garage senza avvisi. La lista canonica vive in geometria.ts. */}
                <select
                  className={controlClassName}
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
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Sup. lorda (mq)">
                <input
                  className={controlClassName}
                  value={riga.valoreLordo}
                  onChange={(e) => aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { valoreLordo: e.target.value }) })}
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Rimuovi piano"
              onClick={() => aggiorna({ superfici: rimuoviRiga(stato.superfici, i) })}
              className="mb-3"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => aggiorna({ superfici: [...stato.superfici, { piano: '', valoreLordo: '' } satisfies SuperficiePiano] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi piano
          </span>
        </Button>

        <div className="mt-4">
          <Field label={`Totale superfici lorde calcolato: ${totaleSuperficiLorde(stato.superfici)} mq — sovrascrivi (spec §3.9)`}>
            <input
              type="number"
              className={controlClassName}
              value={stato.totaleLordoManuale ?? ''}
              placeholder={String(totaleSuperficiLorde(stato.superfici))}
              onChange={(e) => aggiorna({ totaleLordoManuale: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="mt-2">
          <Field label="Totale superfici lorde (testo per il documento, spec §2 — resta editabile)">
            <input
              className={controlClassName}
              value={stato.totaleLordoTesto ?? ''}
              placeholder={suggerisciTotaleLordoTesto(stato.superfici, stato.totaleLordoManuale)}
              onChange={(e) => aggiorna({ totaleLordoTesto: e.target.value === '' ? undefined : e.target.value })}
            />
          </Field>
        </div>

        <Field label="Perimetro (ml)">
          <input
            type="number"
            className={controlClassName}
            value={stato.perimetro}
            onChange={(e) => aggiorna({ perimetro: Number(e.target.value) })}
          />
        </Field>
      </Section>

      <Section title="Serramenti">
        {stato.serramenti.map((riga, i) => (
          <div key={i} className="mb-2 grid grid-cols-5 items-end gap-2">
            <Field label="Piano">
              <input
                className={controlClassName}
                value={riga.piano}
                onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { piano: e.target.value }) })}
              />
            </Field>
            <Field label="Tipologia">
              <input
                className={controlClassName}
                value={riga.tipologia}
                onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { tipologia: e.target.value }) })}
              />
            </Field>
            <Field label="Categoria">
              <select
                className={controlClassName}
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
            </Field>
            <Field label="Base (m)">
              <input
                type="number"
                className={controlClassName}
                value={riga.b}
                onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { b: Number(e.target.value) }) })}
              />
            </Field>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Altezza (m)">
                  <input
                    type="number"
                    className={controlClassName}
                    value={riga.h}
                    onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { h: Number(e.target.value) }) })}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Rimuovi serramento"
                onClick={() => aggiorna({ serramenti: rimuoviRiga(stato.serramenti, i) })}
                className="mb-3"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            aggiorna({
              serramenti: [
                ...stato.serramenti,
                { n: stato.serramenti.length + 1, piano: '', tipologia: '', categoria: 'finestra-battente', b: 0, h: 0 } satisfies Serramento,
              ],
            })
          }
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi serramento
          </span>
        </Button>
      </Section>

      <DatiImportatiExcel stato={stato} />
    </Section>
  )
}

// Pareti/falde/travi arrivano solo dall'import Excel (v2): il motore di calcolo non li usa
// come driver di prezzo (nessuna voce del catalogo è priced su di essi), quindi restano
// di sola lettura — non c'è uno stato da modificare, solo dati di riferimento da consultare.
function DatiImportatiExcel({ stato }: { stato: StatoForm }) {
  const haPareti = (stato.pareti?.length ?? 0) > 0
  const haFalde = (stato.falde?.length ?? 0) > 0
  const haTravi = (stato.travi?.length ?? 0) > 0
  if (!haPareti && !haFalde && !haTravi) return null

  return (
    <Section title="Dati tecnici importati dall'Excel (di riferimento, non prezzati)">
      {haPareti && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Pareti</p>
          <ul className="text-sm text-text-secondary">
            {stato.pareti!.map((parete) => (
              <li key={parete.n}>
                n. {parete.n} · {parete.tipo === 'E' ? 'esterna' : 'interna'} · {parete.b}×{parete.h} m · sp. {parete.spessore} mm
              </li>
            ))}
          </ul>
        </div>
      )}
      {haFalde && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Copertura</p>
          <ul className="text-sm text-text-secondary">
            {stato.falde!.map((voce, i) => (
              <li key={i}>
                {voce.etichetta}: {voce.notazione}
              </li>
            ))}
          </ul>
        </div>
      )}
      {haTravi && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Travi</p>
          <ul className="text-sm text-text-secondary">
            {stato.travi!.map((voce, i) => (
              <li key={i}>
                {voce.etichetta}: {voce.notazione}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}
