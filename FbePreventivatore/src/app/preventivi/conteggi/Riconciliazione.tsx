'use client'

import type { RisultatoConteggio } from '@/domain/computo/conteggio'
import { COSTI_SICUREZZA_FORFETTARI } from '@/domain/computo/conteggio'
import { applicaScontiACascata, calcolaParziale } from '@/domain/calcolo'
import { quantitaIt } from '@/domain/computo/formatta-numero'
import { formattaEuro } from './formatta'

interface Props {
  esito: RisultatoConteggio
  totaleComputo: number
  numeroMaster: Record<string, string>
}

/** Default del foglio Conteggi Master. */
const SCONTI = [
  { percentuale: 0.02, causale: 'sconto cliente' },
  { percentuale: 0.03, causale: 'per conferme entro il 31.07.2026' },
]

export function Riconciliazione({ esito, totaleComputo, numeroMaster }: Props) {
  const listino = esito.target
  // A cascata, non additivi — vincolo CLAUDE.md #1: il secondo sconto si applica al
  // residuo dopo il primo, non al listino pieno.
  const sconti = applicaScontiACascata(listino, SCONTI)
  // arrotondamento fisso a 0: la leva manuale che porta il totale su una cifra tonda
  // resta al wizard dei preventivi, qui si mostra solo la riconciliazione. calcolaParziale
  // applica comunque arrotondaCentesimi al risultato, invece di riscrivere Math.round a mano.
  const parziale = calcolaParziale(listino, sconti, 0)

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-base font-semibold text-text">Riconciliazione</h2>

      <div className="rounded-lg border border-border-warm bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Riconciliazione fra le voci conteggiate e il totale del computo
          </caption>
          <thead>
            <tr className="border-b border-border-warm text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              <th scope="col" className="px-5 py-3 text-left">
                Voce
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Importo
              </th>
            </tr>
          </thead>
          <tbody>
            <Riga etichetta="Somma delle voci conteggiate" valore={esito.sommaVoci} />
            <Riga
              etichetta={`Totale computo − ${formattaEuro(COSTI_SICUREZZA_FORFETTARI)} di sicurezza`}
              valore={esito.target}
              nota={`da ${formattaEuro(totaleComputo)}`}
            />
            <Riga
              etichetta="Delta caricato sulle pareti strutturali"
              valore={esito.delta}
              evidenzia
            />
          </tbody>
        </table>
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-border-warm bg-white">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="px-4 pt-4 pb-2 text-left text-[11px] font-bold uppercase tracking-wide text-accent">
            Voci dell&apos;offerta
          </caption>
          <thead>
            <tr className="border-b border-border-warm text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              <th scope="col" className="w-12 px-4 py-2 text-left">
                N.
              </th>
              <th scope="col" className="py-2 pr-4 text-left">
                Voce
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Importo
              </th>
            </tr>
          </thead>
          <tbody>
            {esito.voci.map((voce) => (
              <tr key={voce.idMaster} className="border-b border-border-warm/60 last:border-0">
                <td className="w-12 px-4 py-2 font-mono text-xs text-text-secondary">
                  {numeroMaster[voce.idMaster] ?? ''}
                </td>
                <td className="py-2 pr-4 text-text">{voce.descrizione}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-text">
                  {typeof voce.importo === 'number' ? formattaEuro(voce.importo) : voce.importo}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-text bg-cream font-semibold">
              <td />
              <td className="py-2 pr-4 text-text">Listino</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-text">
                {formattaEuro(listino)}
              </td>
            </tr>
            {sconti.map((sconto) => (
              <tr key={sconto.ordine} className="border-b border-border-warm/60">
                <td className="px-4 py-2 font-mono text-xs text-text-secondary">
                  {quantitaIt(sconto.percentuale * 100)}%
                </td>
                <td className="py-2 pr-4 text-text-secondary">{sconto.causale}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-text-secondary">
                  − {formattaEuro(sconto.importoCalcolato)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border-warm bg-cream font-semibold">
              <td />
              <td className="py-2 pr-4 text-text">Parziale al grezzo avanzato, esclusa I.V.A.</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-text">
                {formattaEuro(parziale)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-text-secondary">
        Gli sconti sono a cascata: il secondo si applica al residuo dopo il primo.
        L&apos;arrotondamento manuale che porta il totale su una cifra tonda resta al
        wizard dei preventivi.
      </p>
    </section>
  )
}

function Riga({
  etichetta,
  valore,
  nota,
  evidenzia,
}: {
  etichetta: string
  valore: number
  nota?: string
  evidenzia?: boolean
}) {
  return (
    <tr className={`border-b border-border-warm/60 last:border-0 ${evidenzia ? 'bg-cream' : ''}`}>
      <td className="px-5 py-3 text-text">
        {etichetta}
        {nota && <span className="ml-2 text-xs text-text-secondary">{nota}</span>}
      </td>
      <td
        className={`px-5 py-3 text-right font-mono tabular-nums text-text ${
          evidenzia ? 'font-semibold' : ''
        }`}
      >
        {formattaEuro(valore)}
      </td>
    </tr>
  )
}
