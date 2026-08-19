import { segmentaPlaceholder } from '@/domain/calcolo'

interface Props {
  descrizione: string
}

export function DescrizioneVoce({ descrizione }: Props) {
  return (
    <>
      {segmentaPlaceholder(descrizione).map((segmento, indice) =>
        segmento.placeholder ? (
          <span key={indice} className="placeholder-non-interpolato">
            {segmento.testo}
          </span>
        ) : (
          <span key={indice}>{segmento.testo}</span>
        ),
      )}
    </>
  )
}
