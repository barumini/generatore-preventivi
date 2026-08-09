import type { ReactNode } from 'react'

// `tabular-nums` è richiesto dalla spec per gli importi/superfici: le cifre a larghezza
// fissa mantengono allineate le colonne numeriche del wizard.
export const controlClassName =
  'w-full rounded-md border border-border-warm bg-cream px-2.5 py-2 text-sm text-text tabular-nums focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30'

interface Props {
  label: string
  children: ReactNode
}

export function Field({ label, children }: Props) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11.5px] font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  )
}
