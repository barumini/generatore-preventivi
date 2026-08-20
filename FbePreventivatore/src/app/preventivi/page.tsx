import { prisma } from '@/server/prisma'
import { elencaPreventivi } from '@/server/preventivi-repo'
import { TabellaPreventivi } from './TabellaPreventivi'
import { Breadcrumb } from './ui/Breadcrumb'

export default async function ElencoPreventivi() {
  const preventivi = await elencaPreventivi(prisma)

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <Breadcrumb voci={[{ label: 'Home', href: '/' }, { label: 'Preventivi' }]} />
      <h1 className="mb-4 text-lg font-bold text-text">Preventivi</h1>
      <TabellaPreventivi preventivi={preventivi} />
    </div>
  )
}
