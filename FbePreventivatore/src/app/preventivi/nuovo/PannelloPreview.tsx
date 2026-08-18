// src/app/preventivi/nuovo/PannelloPreview.tsx
'use client'

import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { totaleSuperficiLorde, PIANO_GARAGE } from '@/domain/geometria'
import { generaAbacoPerCategoria } from '@/ai/abaco'
import { verificaCoerenza } from '@/ai/coerenza'
import { Alert } from '../ui/Alert'
import { PaginaCaratteristiche } from '@/documento/preview/PaginaCaratteristiche'
import { PaginaPrezzi } from '@/documento/preview/PaginaPrezzi'
import { PaginaAbacoSerramenti } from '@/documento/preview/PaginaAbacoSerramenti'
import { PaginaCondizioni } from '@/documento/preview/PaginaCondizioni'
import { CONDIZIONI_DEFAULT, CONDIZIONE_DA_DEFINIRE } from '@/documento/condizioni-default'
import { formattaImportoItaliano } from '@/documento/preview/formattazione'
import { pacchettoDaLivelli } from './stato-form'
import type { StatoForm } from './stato-form'

interface Props {
  stato: StatoForm
  input: InputCalcolo
}

export function PannelloPreview({ stato, input }: Props) {
  const risultato = eseguiCalcolo(input)
  const abaco = generaAbacoPerCategoria(stato.serramenti)

  // Le revisioni salvate prima di questa feature non hanno la chiave `condizioni` nel loro
  // JSON: CLAUDE.md vincolo 6 impone che restino apribili con gli stessi numeri firmati, quindi
  // qui serve un fallback esplicito (il merge in FormStrutturato copre solo il percorso bozza,
  // non questa pagina di sola lettura che deserializza il JSON grezzo senza passare da lì).
  const condizioni = stato.condizioni ?? CONDIZIONI_DEFAULT

  // Gli avvisi di coerenza stanno PRIMA delle pagine: sono i bug osservati nei
  // documenti FBE reali (superfici che non tornano, protocollo non sostituito,
  // arrotondamento fuori soglia, riferimenti a voci inesistenti).
  // `sezioniDaDefinire` e `riferimentiTestuali` restano vuoti finché il wizard
  // non raccoglie quei dati: passare liste finte produrrebbe avvisi finti.
  const avvisi = verificaCoerenza({
    superfici: stato.superfici,
    totaleLordoDichiarato: stato.totaleLordoManuale ?? totaleSuperficiLorde(stato.superfici),
    risultato,
    protocolloPlaceholderPresente: stato.protocollo.trim() === '',
    sezioniDaDefinire: [],
    riferimentiTestuali: [],
  })

  return (
    <div>
      {avvisi.length > 0 && (
        <section aria-label="Avvisi di coerenza" className="mb-4 space-y-2">
          {avvisi.map((avviso, i) => (
            <div key={`${avviso.tipo}-${i}`} data-tipo-avviso={avviso.tipo}>
              <Alert variant="avviso">{avviso.messaggio}</Alert>
            </div>
          ))}
        </section>
      )}
      <PaginaCaratteristiche
        sistemaCostruttivo="MassivHolzMauer® (M.H.M.)"
        tetto={stato.caratteristiche.tetto}
        mantoCopertura={stato.caratteristiche.manto}
        finituraEsterna={
          stato.caratteristiche.finituraEsterna.charAt(0).toUpperCase() + stato.caratteristiche.finituraEsterna.slice(1)
        }
        pacchetto={pacchettoDaLivelli(stato.livelli)}
        superfici={stato.superfici.filter((s) => s.piano !== PIANO_GARAGE)}
        superficieGarage={stato.superfici.find((s) => s.piano === PIANO_GARAGE)?.valoreLordo ?? ''}
      />
      <PaginaPrezzi risultato={risultato} annoListino={input.listino.anno} />
      <PaginaCondizioni
        caparra={condizioni.caparra > 0 ? formattaImportoItaliano(condizioni.caparra) : CONDIZIONE_DA_DEFINIRE}
        sal={condizioni.sal.map((s) => ({ percentuale: s.percentuale, milestone: s.descrizione }))}
        consegna={condizioni.consegna.trim() === '' ? CONDIZIONE_DA_DEFINIRE : condizioni.consegna}
        validita={condizioni.validita.trim() === '' ? CONDIZIONE_DA_DEFINIRE : condizioni.validita}
      />
      <PaginaAbacoSerramenti abaco={abaco} />
    </div>
  )
}
