import type { RisultatoCalcolo } from '@/domain/calcolo'
import { formattaImportoItaliano } from './formattazione'
import { righeVoci, segnoArrotondamento as calcolaSegnoArrotondamento, formattaPercentuale } from '../tabella-prezzi'
import { DescrizioneVoce } from './DescrizioneVoce'

interface Props {
  risultato: RisultatoCalcolo
  annoListino: number
}

export function PaginaPrezzi({ risultato, annoListino }: Props) {
  const { vociGrezzo, vociPostSconto } = righeVoci(risultato)

  // cfr. tabella-prezzi.ts: stessa logica di segno usata da export-docx.ts
  const segnoArrotondamento = calcolaSegnoArrotondamento(risultato.arrotondamento)
  const arrotondamentoAssoluto = Math.abs(risultato.arrotondamento)

  return (
    <div className="pagina-a4">
      <table>
        <tbody>
          {vociGrezzo.map((v) => (
            <tr key={v.id} data-provenienza={v.provenienza}>
              <td>{v.numero}</td>
              <td><DescrizioneVoce descrizione={v.descrizione} /></td>
              <td className="importo">{formattaImportoItaliano(v.importo)}</td>
            </tr>
          ))}
          <tr><td /><td><strong>Listino {annoListino}</strong></td><td className="importo">{formattaImportoItaliano(risultato.listinoTotale)}</td></tr>
          {risultato.sconti.map((s) => (
            <tr key={s.ordine}>
              <td />
              <td>SCONTO RISERVATO: {formattaPercentuale(s.percentuale)} {s.causale}</td>
              <td className="importo">- {formattaImportoItaliano(s.importoCalcolato)}</td>
            </tr>
          ))}
          <tr><td /><td>Arrotondamento</td><td className="importo">{segnoArrotondamento} {formattaImportoItaliano(arrotondamentoAssoluto)}</td></tr>
          <tr><td /><td><strong>PARZIALE AL GREZZO AVANZATO esclusa I.V.A.</strong></td><td className="importo">{formattaImportoItaliano(risultato.parziale)}</td></tr>
          <tr><td /><td>COSTI SICUREZZA: SICUREZZA costo {formattaImportoItaliano(risultato.sicurezza.costoDichiarato)}</td><td className="importo">{formattaImportoItaliano(risultato.sicurezza.valorizzata)}</td></tr>
          {vociPostSconto.map((v) => (
            <tr key={v.id} data-provenienza={v.provenienza}>
              <td>{v.numero}</td>
              <td><DescrizioneVoce descrizione={v.descrizione} /></td>
              <td className="importo">{formattaImportoItaliano(v.importo)}</td>
            </tr>
          ))}
          <tr><td /><td><strong>TOTALE AL NETTO esclusa I.V.A.</strong></td><td className="importo">{formattaImportoItaliano(risultato.totaleNetto)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}
