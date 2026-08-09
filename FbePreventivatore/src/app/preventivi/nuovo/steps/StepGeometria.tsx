import {
  totaleSuperficiLorde,
  PIANI_CANONICI,
  CATEGORIE_SERRAMENTO,
  type CategoriaSerramento,
  type Serramento,
  type SuperficiePiano,
} from '@/domain/geometria'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepGeometria({ stato, aggiorna }: Props) {
  return (
    <fieldset>
      <legend>Geometria</legend>

      <h4>Superfici per piano</h4>
      {stato.superfici.map((riga, i) => (
        <div key={i}>
          <label>
            Piano
            {/* Il dominio confronta i nomi piano per stringa esatta: un testo libero
                come "Piano terra" azzererebbe il driver della copertura e farebbe
                sparire il garage senza avvisi. La lista canonica vive in geometria.ts. */}
            <select
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
          </label>
          <label>
            Sup. lorda (mq)
            <input
              value={riga.valoreLordo}
              onChange={(e) => aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { valoreLordo: e.target.value }) })}
            />
          </label>
          <button type="button" onClick={() => aggiorna({ superfici: rimuoviRiga(stato.superfici, i) })}>
            Rimuovi
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => aggiorna({ superfici: [...stato.superfici, { piano: '', valoreLordo: '' } satisfies SuperficiePiano] })}
      >
        Aggiungi piano
      </button>

      <label>
        Totale superfici lorde calcolato: {totaleSuperficiLorde(stato.superfici)} mq — sovrascrivi (spec §3.9)
        <input
          type="number"
          value={stato.totaleLordoManuale ?? ''}
          placeholder={String(totaleSuperficiLorde(stato.superfici))}
          onChange={(e) => aggiorna({ totaleLordoManuale: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </label>

      <label>
        Perimetro (ml)
        <input type="number" value={stato.perimetro} onChange={(e) => aggiorna({ perimetro: Number(e.target.value) })} />
      </label>

      <h4>Serramenti</h4>
      {stato.serramenti.map((riga, i) => (
        <div key={i}>
          <label>
            Piano
            <input
              value={riga.piano}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { piano: e.target.value }) })}
            />
          </label>
          <label>
            Tipologia
            <input
              value={riga.tipologia}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { tipologia: e.target.value }) })}
            />
          </label>
          <label>
            Categoria
            <select
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
          </label>
          <label>
            Base (m)
            <input
              type="number"
              value={riga.b}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { b: Number(e.target.value) }) })}
            />
          </label>
          <label>
            Altezza (m)
            <input
              type="number"
              value={riga.h}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { h: Number(e.target.value) }) })}
            />
          </label>
          <button type="button" onClick={() => aggiorna({ serramenti: rimuoviRiga(stato.serramenti, i) })}>
            Rimuovi
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          aggiorna({
            serramenti: [
              ...stato.serramenti,
              { n: stato.serramenti.length + 1, piano: '', tipologia: '', categoria: 'finestra-battente', b: 0, h: 0 } satisfies Serramento,
            ],
          })
        }
      >
        Aggiungi serramento
      </button>
    </fieldset>
  )
}
