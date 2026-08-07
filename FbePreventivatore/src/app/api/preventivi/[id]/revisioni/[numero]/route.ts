import { prisma } from '@/server/prisma'
import { aggiornaBozza, caricaRevisione } from '@/server/preventivi-repo'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero } = await params
  const revisione = await caricaRevisione(prisma, id, Number(numero))
  if (!revisione) return Response.json({ errore: 'Revisione non trovata' }, { status: 404 })
  return Response.json(revisione)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero } = await params
  const corpo = await request.json()
  try {
    const revisione = await aggiornaBozza(prisma, id, Number(numero), corpo)
    return Response.json(revisione)
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    return Response.json({ errore: messaggio }, { status: 409 })
  }
}
