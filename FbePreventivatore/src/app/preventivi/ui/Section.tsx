import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

export function Section({ title, children }: Props) {
  return (
    <section className="mb-4 rounded-lg border border-border-warm bg-white p-4">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-accent">{title}</h3>
      {children}
    </section>
  )
}
