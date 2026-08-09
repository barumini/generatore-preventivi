import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'border border-border-warm text-text hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50',
  ghost: 'text-text-secondary hover:text-error',
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
    />
  )
}
