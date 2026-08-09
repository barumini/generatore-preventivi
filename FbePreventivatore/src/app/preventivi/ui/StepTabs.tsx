interface Props {
  titoli: string[]
  stepCorrente: number
  onSeleziona: (indice: number) => void
}

export function StepTabs({ titoli, stepCorrente, onSeleziona }: Props) {
  return (
    <nav className="mb-4 flex gap-1">
      {titoli.map((titolo, i) => (
        <button
          key={titolo}
          type="button"
          onClick={() => onSeleziona(i)}
          aria-current={i === stepCorrente}
          className={`flex-1 rounded-t-md px-2 py-2.5 text-xs font-semibold transition-colors ${
            i === stepCorrente ? 'bg-accent text-white' : 'bg-border-warm/60 text-text-secondary hover:bg-border-warm'
          }`}
        >
          {i + 1}. {titolo}
        </button>
      ))}
    </nav>
  )
}
