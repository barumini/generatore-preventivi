import { prisma } from '@/server/prisma'
import { elencaPreventivi } from '@/server/preventivi-repo'
import { TabellaPreventivi } from './TabellaPreventivi'

export default async function ElencoPreventivi() {
  const preventivi = await elencaPreventivi(prisma)

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <h1 className="mb-4 text-lg font-bold text-text">Preventivi</h1>
      <TabellaPreventivi preventivi={preventivi} />
    </div>
  )
}
