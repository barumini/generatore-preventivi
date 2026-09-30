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
import type { Parete, VoceGeometricaLibera } from '@/domain/importazione-excel'
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
          <CampoNumerico
            valore={stato.perimetro}
            onCambia={(v) => aggiorna({ perimetro: v })}
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
              <CampoNumerico
                valore={riga.b}
                onCambia={(v) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { b: v }) })}
              />
            </Field>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Altezza (m)">
                  <CampoNumerico
                    valore={riga.h}
                    onCambia={(v) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { h: v }) })}
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

      <Section title="Pareti (dati tecnici di riferimento, non prezzati)">
        {(stato.pareti ?? []).map((riga, i) => (
          <div key={i} className="mb-2 grid grid-cols-5 items-end gap-2">
            <Field label="Tipo">
              <select
                className={controlClassName}
                value={riga.tipo}
                onChange={(e) => aggiorna({ pareti: aggiornaRiga(stato.pareti ?? [], i, { tipo: e.target.value as Parete['tipo'] }) })}
              >
                <option value="E">Esterna (E)</option>
                <option value="I">Interna (I)</option>
              </select>
            </Field>
            <Field label="Base (m)">
              <CampoNumerico
                valore={riga.b}
                onCambia={(v) => aggiorna({ pareti: aggiornaRiga(stato.pareti ?? [], i, { b: v }) })}
              />
            </Field>
            <Field label="Altezza (m)">
              <CampoNumerico
                valore={riga.h}
                onCambia={(v) => aggiorna({ pareti: aggiornaRiga(stato.pareti ?? [], i, { h: v }) })}
              />
            </Field>
            <Field label="Spessore (mm)">
              <CampoNumerico
                valore={riga.spessore}
                onCambia={(v) => aggiorna({ pareti: aggiornaRiga(stato.pareti ?? [], i, { spessore: v }) })}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              aria-label="Rimuovi parete"
              onClick={() => aggiorna({ pareti: rimuoviRiga(stato.pareti ?? [], i) })}
              className="mb-3"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            aggiorna({
              pareti: [
                ...(stato.pareti ?? []),
                { n: (stato.pareti?.length ?? 0) + 1, tipo: 'E', b: 0, h: 0, spessore: 0 } satisfies Parete,
              ],
            })
          }
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi parete
          </span>
        </Button>
      </Section>

      <SezioneVociLibere
        titolo="Copertura (dati tecnici di riferimento, non prezzati)"
        etichettaAggiungi="Aggiungi voce copertura"
        voci={stato.falde}
        onCambia={(falde) => aggiorna({ falde })}
      />

      <SezioneVociLibere
        titolo="Travi (dati tecnici di riferimento, non prezzati)"
        etichettaAggiungi="Aggiungi voce trave"
        voci={stato.travi}
        onCambia={(travi) => aggiorna({ travi })}
      />
    </Section>
  )
}

// Falde e travi condividono la stessa forma libera (etichetta + notazione, mai
// interpretata come numero — stessa scelta di importazione-excel.ts): un solo componente
// per entrambe le sezioni, che siano arrivate dall'import Excel, dalla chat AI o digitate.
function SezioneVociLibere({
  titolo,
  etichettaAggiungi,
  voci,
  onCambia,
}: {
  titolo: string
  etichettaAggiungi: string
  voci: VoceGeometricaLibera[] | undefined
  onCambia: (voci: VoceGeometricaLibera[]) => void
}) {
  const righe = voci ?? []
  return (
    <Section title={titolo}>
      {righe.map((riga, i) => (
        <div key={i} className="mb-2 flex items-end gap-2">
          <div className="flex-1">
            <Field label="Etichetta">
              <input
                className={controlClassName}
                value={riga.etichetta}
                onChange={(e) => onCambia(aggiornaRiga(righe, i, { etichetta: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Notazione">
              <input
                className={controlClassName}
                value={riga.notazione}
                onChange={(e) => onCambia(aggiornaRiga(righe, i, { notazione: e.target.value }))}
              />
            </Field>
          </div>
          <Button type="button" variant="ghost" aria-label="Rimuovi voce" onClick={() => onCambia(rimuoviRiga(righe, i))} className="mb-3">
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onCambia([...righe, { etichetta: '', notazione: '' } satisfies VoceGeometricaLibera])}
      >
        <span className="flex items-center gap-1.5">
          <Plus size={14} /> {etichettaAggiungi}
        </span>
      </Button>
    </Section>
  )
}
