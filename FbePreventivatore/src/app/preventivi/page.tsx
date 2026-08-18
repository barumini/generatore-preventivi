import Link from 'next/link'
import { prisma } from '@/server/prisma'
import { elencaPreventivi } from '@/server/preventivi-repo'

export default async function ElencoPreventivi() {
  const preventivi = await elencaPreventivi(prisma)

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <h1 className="mb-4 text-lg font-bold text-text">Preventivi</h1>
      <div className="overflow-hidden rounded-lg border border-border-warm bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-warm bg-cream text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              <th className="px-4 py-2.5">Cliente</th>
              <th className="px-4 py-2.5">Protocollo</th>
              <th className="px-4 py-2.5">Ultima revisione</th>
              <th className="px-4 py-2.5">Stato</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {preventivi.map((p) => (
              <tr key={p.id} className="border-b border-border-warm last:border-b-0">
                <td className="px-4 py-2.5 text-text">{p.cliente.nome}</td>
                <td className="px-4 py-2.5 text-text-secondary">{p.protocollo}</td>
                <td className="px-4 py-2.5 text-text-secondary">{p.ultimaRevisione?.numero ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-secondary">{p.ultimaRevisione?.stato ?? '—'}</td>
                <td className="px-4 py-2.5">
                  {p.ultimaRevisione && (
                    <Link
                      href={`/preventivi/${p.id}/revisioni/${p.ultimaRevisione.numero}`}
                      className="font-semibold text-accent hover:text-accent-hover"
                    >
                      Apri
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
