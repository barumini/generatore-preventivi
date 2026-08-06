// src/app/preventivi/nuovo/PannelloPreview.tsx
'use client'

import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { totaleSuperficiLorde, PIANO_GARAGE } from '@/domain/geometria'
import { generaAbacoSerramenti } from '@/ai/abaco'
import { verificaCoerenza } from '@/ai/coerenza'
import { PaginaCaratteristiche } from '@/documento/preview/PaginaCaratteristiche'
import { PaginaPrezzi } from '@/documento/preview/PaginaPrezzi'
import { PaginaAbacoSerramenti } from '@/documento/preview/PaginaAbacoSerramenti'
import { PaginaCondizioni } from '@/documento/preview/PaginaCondizioni'
import { SAL_DEFAULT, CONDIZIONE_DA_DEFINIRE } from '@/documento/condizioni-default'
import type { StatoForm } from './stato-form'

interface Props {
  stato: StatoForm
  input: InputCalcolo
}

export function PannelloPreview({ stato, input }: Props) {
  const risultato = eseguiCalcolo(input)
  const abaco = generaAbacoSerramenti(stato.serramenti)

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
        <section aria-label="Avvisi di coerenza">
          {avvisi.map((avviso, i) => (
            <p key={`${avviso.tipo}-${i}`} role="alert" data-tipo-avviso={avviso.tipo}>
              {avviso.messaggio}
            </p>
          ))}
        </section>
      )}
      <PaginaCaratteristiche
        sistemaCostruttivo="MassivHolzMauer® (M.H.M.)"
        tetto="Tetto con travi e perline in abete"
        mantoCopertura="Tegole in cemento"
        finituraEsterna="Intonaco"
        pacchetto="Grezzo avanzato"
        superfici={stato.superfici.filter((s) => s.piano !== PIANO_GARAGE)}
        superficieGarage={stato.superfici.find((s) => s.piano === PIANO_GARAGE)?.valoreLordo ?? ''}
      />
      <PaginaPrezzi risultato={risultato} annoListino={input.listino.anno} />
      {/* Il wizard non raccoglie ancora le condizioni (follow-up): la scaletta SAL
          usa i default reali FBE, mentre caparra/consegna/validità restano
          segnaposto espliciti perché l'operatore veda che sono da compilare. */}
      <PaginaCondizioni
        caparra={CONDIZIONE_DA_DEFINIRE}
        sal={SAL_DEFAULT}
        consegna={CONDIZIONE_DA_DEFINIRE}
        validita={CONDIZIONE_DA_DEFINIRE}
      />
      <PaginaAbacoSerramenti abaco={abaco} />
    </div>
  )
}
