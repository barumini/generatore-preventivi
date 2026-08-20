import Link from 'next/link'

interface Voce {
  label: string
  href?: string
}

interface Props {
  voci: Voce[]
}

export function Breadcrumb({ voci }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
      {voci.map((voce, indice) => (
        <span key={voce.label} className="flex items-center gap-2">
          {indice > 0 && <span aria-hidden="true">/</span>}
          {voce.href ? (
            <Link href={voce.href} className="hover:text-accent">
              {voce.label}
            </Link>
          ) : (
            <span className="font-semibold text-text">{voce.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
