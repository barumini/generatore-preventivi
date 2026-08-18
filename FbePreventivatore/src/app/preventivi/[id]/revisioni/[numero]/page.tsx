import { prisma } from '@/server/prisma'
import { caricaRevisione } from '@/server/preventivi-repo'
import { deserializzaRevisione } from '@/domain/persistenza'
import { PannelloPreview } from '@/app/preventivi/nuovo/PannelloPreview'
import { WizardConSalvataggio } from '@/app/preventivi/WizardConSalvataggio'
import { Alert } from '@/app/preventivi/ui/Alert'
import type { StatoForm } from '@/app/preventivi/nuovo/stato-form'

interface Props {
  params: Promise<{ id: string; numero: string }>
}

export default async function RiapriRevisione({ params }: Props) {
  const { id, numero } = await params
  const revisione = await caricaRevisione(prisma, id, Number(numero))
  if (!revisione) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <Alert variant="errore">Revisione non trovata.</Alert>
      </div>
    )
  }

  const { stato, input } = deserializzaRevisione<StatoForm>(
    revisione.statoForm,
    revisione.inputCalcolo,
    revisione.risultatoCalcolo,
  )

  if (revisione.stato === 'bozza') {
    return <WizardConSalvataggio statoIniziale={stato} preventivoEsistente={{ id, numero: revisione.numero }} />
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <p className="mb-4 text-sm text-text-secondary">
        Revisione {revisione.numero} — stato: <span className="font-semibold text-text">{revisione.stato}</span> (sola lettura)
      </p>
      <PannelloPreview stato={stato} input={input} />
    </div>
  )
}
