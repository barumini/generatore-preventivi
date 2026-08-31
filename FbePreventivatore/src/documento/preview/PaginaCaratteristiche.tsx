import type { SuperficiePiano } from '@/domain/geometria'

interface Props {
  sistemaCostruttivo: string
  tetto: string
  mantoCopertura: string
  finituraEsterna: string
  pacchetto: string
  superfici: SuperficiePiano[]
  superficieGarage: string
}

export function PaginaCaratteristiche({
  sistemaCostruttivo,
  tetto,
  mantoCopertura,
  finituraEsterna,
  pacchetto,
  superfici,
  superficieGarage,
}: Props) {
  return (
    <div className="pagina-a4">
      <h2>Preventivo</h2>
      <h3>CARATTERISTICHE STRUTTURA</h3>
      <table>
        <tbody>
          <tr><td>SISTEMA COSTRUTTIVO</td><td>{sistemaCostruttivo}</td></tr>
          <tr><td>TETTO</td><td>{tetto}</td></tr>
          <tr><td>MANTO DI COPERTURA</td><td>{mantoCopertura}</td></tr>
          <tr><td>FINITURA ESTERNA</td><td>{finituraEsterna}</td></tr>
          <tr><td>PACCHETTO DI CONSEGNA</td><td>{pacchetto}</td></tr>
        </tbody>
      </table>
      <h3>CARATTERISTICHE FABBRICATO</h3>
      <table>
        <tbody>
          {superfici.map((s, i) => (
            <tr key={i}>
              <td>{s.piano}</td>
              <td>Sup. lorda</td>
              <td className="importo">{s.valoreLordo}</td>
              <td>Mq</td>
            </tr>
          ))}
          <tr>
            <td>Garage</td>
            <td>Sup. lorda</td>
            <td className="importo">{superficieGarage}</td>
            <td>Mq</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
