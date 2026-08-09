import type { ReactNode } from 'react'

export const controlClassName =
  'w-full rounded-md border border-border-warm bg-cream px-2.5 py-2 text-sm text-text focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30'

interface Props {
  label: string
  children: ReactNode
  error?: string
}

export function Field({ label, children, error }: Props) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11.5px] font-medium text-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  )
}
