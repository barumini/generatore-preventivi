import type { AbacoPerCategoria } from '@/ai/abaco'

interface Props {
  abaco: AbacoPerCategoria
}

const ETICHETTE_CATEGORIA: { chiave: Exclude<keyof AbacoPerCategoria, 'tutti'>; titolo: string }[] = [
  { chiave: 'finestreBattente', titolo: 'Finestre a battente' },
  { chiave: 'portefinestreBattente', titolo: 'Portefinestre a battente' },
  { chiave: 'fissiVetrate', titolo: 'Fissi e vetrate' },
  { chiave: 'alzantiScorrevoli', titolo: 'Alzanti scorrevoli' },
  { chiave: 'portoncini', titolo: "Portoncino d'ingresso" },
]

export function PaginaAbacoSerramenti({ abaco }: Props) {
  return (
    <div className="pagina-a4">
      <h3>Serramenti e portoncino d&apos;ingresso</h3>
      {ETICHETTE_CATEGORIA.map(({ chiave, titolo }) =>
        abaco[chiave] ? (
          <p key={chiave}>
            <strong>{titolo}</strong>: {abaco[chiave]}
          </p>
        ) : null,
      )}
    </div>
  )
}
