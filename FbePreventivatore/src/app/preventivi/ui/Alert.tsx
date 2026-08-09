import type { ReactNode } from 'react'

type Variant = 'errore' | 'avviso'

interface Props {
  variant: Variant
  children: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  errore: 'border-error/30 bg-error/5 text-error',
  avviso: 'border-warning/30 bg-warning/5 text-warning',
}

export function Alert({ variant, children }: Props) {
  return (
    <p role="alert" className={`mb-2 rounded-md border px-3 py-2 text-sm ${VARIANT_CLASSES[variant]}`}>
      {children}
    </p>
  )
}
