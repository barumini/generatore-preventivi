'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { controlClassName } from './Field'
import { testoCoerente, testoDaValore, valoreDaTesto } from './campo-numerico'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  valore: number
  onCambia: (valore: number) => void
}

// Input numerico che si può svuotare con Canc/Backspace: il testo a schermo è stato locale,
// il valore numerico (vuoto = 0) va al chiamante. Il testo si riallinea solo quando il valore
// cambia dall'esterno (es. bozza riaperta, estrazione AI), non a ogni battuta.
export function CampoNumerico({ valore, onCambia, className, placeholder = '0', ...resto }: Props) {
  const [testo, setTesto] = useState(() => testoDaValore(valore))
  const [valoreVisto, setValoreVisto] = useState(valore)

  if (valore !== valoreVisto) {
    setValoreVisto(valore)
    if (!testoCoerente(testo, valore)) setTesto(testoDaValore(valore))
  }

  return (
    <input
      {...resto}
      type="number"
      className={className ?? controlClassName}
      placeholder={placeholder}
      value={testo}
      onChange={(e) => {
        const nuovo = valoreDaTesto(e.target.value)
        setTesto(e.target.value)
        setValoreVisto(nuovo)
        onCambia(nuovo)
      }}
    />
  )
}
