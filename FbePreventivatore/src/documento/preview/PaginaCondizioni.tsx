export interface Sal {
  percentuale: number
  milestone: string
}

interface Props {
  caparra: string
  sal: readonly Sal[]
  consegna: string
  validita: string
}

export function PaginaCondizioni({ caparra, sal, consegna, validita }: Props) {
  return (
    <div className="pagina-a4">
      <h3>Pagamento</h3>
      <table>
        <tbody>
          <tr><td>{caparra}</td><td>Caparra confirmatoria da restituire al SAL 7</td></tr>
          {sal.map((s, i) => (
            <tr key={i}><td>{(s.percentuale * 100).toFixed(0)}%</td><td>{s.milestone}</td></tr>
          ))}
        </tbody>
      </table>
      <p>Consegna: {consegna}</p>
      <p>Validità offerta: {validita}</p>
      <p>IVA: esclusa dai prezzi sopra indicati</p>
    </div>
  )
}
