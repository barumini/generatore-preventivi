import { prisma } from '@/server/prisma'
import { elencaPreventivi } from '@/server/preventivi-repo'
import { TabellaPreventivi } from './TabellaPreventivi'
import { Breadcrumb } from './ui/Breadcrumb'

export default async function ElencoPreventivi() {
  const preventivi = await elencaPreventivi(prisma)

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <Breadcrumb voci={[{ label: 'Home', href: '/' }, { label: 'Preventivi' }]} />
      <div className="mb-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-fbe.webp" alt="FBE Woodliving" className="h-10 w-auto" />
        <h1 className="text-lg font-bold text-text">Preventivi</h1>
      </div>
      <TabellaPreventivi preventivi={preventivi} />
    </div>
  )
}
