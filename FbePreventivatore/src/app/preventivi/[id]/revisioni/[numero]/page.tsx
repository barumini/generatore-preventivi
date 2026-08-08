import { prisma } from '@/server/prisma'
import { caricaRevisione } from '@/server/preventivi-repo'
import { deserializzaRevisione } from '@/domain/persistenza'
import { PannelloPreview } from '@/app/preventivi/nuovo/PannelloPreview'
import { WizardConSalvataggio } from '@/app/preventivi/WizardConSalvataggio'
import type { StatoForm } from '@/app/preventivi/nuovo/stato-form'

interface Props {
  params: Promise<{ id: string; numero: string }>
}

export default async function RiapriRevisione({ params }: Props) {
  const { id, numero } = await params
  const revisione = await caricaRevisione(prisma, id, Number(numero))
  if (!revisione) return <p>Revisione non trovata.</p>

  const { stato, input } = deserializzaRevisione<StatoForm>(
    revisione.statoForm,
    revisione.inputCalcolo,
    revisione.risultatoCalcolo,
  )

  if (revisione.stato === 'bozza') {
    return <WizardConSalvataggio statoIniziale={stato} preventivoEsistente={{ id, numero: revisione.numero }} />
  }

  return (
    <div>
      <p>
        Revisione {revisione.numero} — stato: {revisione.stato} (sola lettura)
      </p>
      <PannelloPreview stato={stato} input={input} />
    </div>
  )
}
