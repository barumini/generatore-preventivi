import Link from 'next/link'
import { prisma } from '@/server/prisma'
import { elencaPreventivi } from '@/server/preventivi-repo'

export default async function ElencoPreventivi() {
  const preventivi = await elencaPreventivi(prisma)

  return (
    <div>
      <h1>Preventivi</h1>
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Protocollo</th>
            <th>Ultima revisione</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {preventivi.map((p) => (
            <tr key={p.id}>
              <td>{p.cliente.nome}</td>
              <td>{p.protocollo}</td>
              <td>{p.ultimaRevisione?.numero ?? '—'}</td>
              <td>{p.ultimaRevisione?.stato ?? '—'}</td>
              <td>
                {p.ultimaRevisione && <Link href={`/preventivi/${p.id}/revisioni/${p.ultimaRevisione.numero}`}>Apri</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
