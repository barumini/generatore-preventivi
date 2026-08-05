interface Props {
  abaco: string
}

export function PaginaAbacoSerramenti({ abaco }: Props) {
  return (
    <div className="pagina-a4">
      <h3>Serramenti e portoncino d&apos;ingresso</h3>
      <p>{abaco}</p>
    </div>
  )
}
