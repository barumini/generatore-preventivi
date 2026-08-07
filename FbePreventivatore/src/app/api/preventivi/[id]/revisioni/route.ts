import { prisma } from '@/server/prisma'
import { aggiungiRevisione, RisorsaNonTrovata } from '@/server/preventivi-repo'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const corpo = await request.json()
  try {
    const revisione = await aggiungiRevisione(prisma, id, corpo)
    return Response.json(revisione, { status: 201 })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    const status = errore instanceof RisorsaNonTrovata ? 404 : 409
    return Response.json({ errore: messaggio }, { status })
  }
}
