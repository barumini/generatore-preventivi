import type { RisultatoCalcolo } from '@/domain/calcolo'
import { formattaImportoItaliano } from './formattazione'

interface Props {
  risultato: RisultatoCalcolo
}

export function PaginaPrezzi({ risultato }: Props) {
  const vociGrezzo = risultato.vociValorizzate.filter((v) => v.gruppo === 'grezzo')
  const vociPostSconto = risultato.vociValorizzate.filter((v) => v.gruppo === 'post_sconto')

  return (
    <div className="pagina-a4">
      <table>
        <tbody>
          {vociGrezzo.map((v) => (
            <tr key={v.id} data-provenienza={v.provenienza}>
              <td>{v.numero}</td>
              <td>{v.descrizione}</td>
              <td className="importo">{formattaImportoItaliano(v.importo)}</td>
            </tr>
          ))}
          <tr><td /><td><strong>Listino {new Date().getFullYear()}</strong></td><td className="importo">{formattaImportoItaliano(risultato.listinoTotale)}</td></tr>
          {risultato.sconti.map((s) => (
            <tr key={s.ordine}>
              <td />
              <td>SCONTO RISERVATO: {(s.percentuale * 100).toFixed(0)}% {s.causale}</td>
              <td className="importo">- {formattaImportoItaliano(s.importoCalcolato)}</td>
            </tr>
          ))}
          <tr><td /><td>Arrotondamento</td><td className="importo">- {formattaImportoItaliano(risultato.arrotondamento)}</td></tr>
          <tr><td /><td><strong>PARZIALE AL GREZZO AVANZATO esclusa I.V.A.</strong></td><td className="importo">{formattaImportoItaliano(risultato.parziale)}</td></tr>
          <tr><td /><td>COSTI SICUREZZA: SICUREZZA costo {formattaImportoItaliano(risultato.sicurezza.costoDichiarato)}</td><td className="importo">{formattaImportoItaliano(risultato.sicurezza.valorizzata)}</td></tr>
          {vociPostSconto.map((v) => (
            <tr key={v.id} data-provenienza={v.provenienza}>
              <td>{v.numero}</td>
              <td>{v.descrizione}</td>
              <td className="importo">{formattaImportoItaliano(v.importo)}</td>
            </tr>
          ))}
          <tr><td /><td><strong>TOTALE AL NETTO esclusa I.V.A.</strong></td><td className="importo">{formattaImportoItaliano(risultato.totaleNetto)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}
