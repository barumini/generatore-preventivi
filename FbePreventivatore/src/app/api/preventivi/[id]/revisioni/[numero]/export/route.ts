import { prisma } from '@/server/prisma'
import { caricaRevisione } from '@/server/preventivi-repo'
import { deserializzaRevisione } from '@/domain/persistenza'
import { costruisciInputEsportazione } from '@/documento/costruisci-input-esportazione'
import { costruisciBufferOfferta } from '@/documento/export-docx'
import type { StatoForm } from '@/app/preventivi/nuovo/stato-form'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero } = await params
  const revisione = await caricaRevisione(prisma, id, Number(numero))
  if (!revisione) return Response.json({ errore: 'Revisione non trovata' }, { status: 404 })

  const { stato, input, risultato } = deserializzaRevisione<StatoForm>(revisione.statoForm, revisione.inputCalcolo, revisione.risultatoCalcolo)

  try {
    const inputEsportazione = costruisciInputEsportazione(
      stato,
      { numero: revisione.numero, protocollo: revisione.preventivo.protocollo },
      { input, risultato },
    )
    const buffer = costruisciBufferOfferta(inputEsportazione)
    const nomeFile = `${revisione.preventivo.protocollo}-rev${inputEsportazione.revisione}.docx`

    await prisma.revisione.update({
      where: { preventivoId_numero: { preventivoId: id, numero: revisione.numero } },
      data: { documentoGeneratoAt: new Date() },
    })

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nomeFile}"`,
      },
    })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    return Response.json({ errore: messaggio }, { status: 422 })
  }
}
