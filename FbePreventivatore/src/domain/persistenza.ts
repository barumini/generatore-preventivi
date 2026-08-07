// src/domain/persistenza.ts
import type { InputCalcolo, RisultatoCalcolo } from './calcolo'

export function serializzaRevisione<T>(
  stato: T,
  input: InputCalcolo,
  risultato: RisultatoCalcolo,
): { statoForm: string; inputCalcolo: string; risultatoCalcolo: string } {
  return {
    statoForm: JSON.stringify(stato),
    inputCalcolo: JSON.stringify(input),
    risultatoCalcolo: JSON.stringify(risultato),
  }
}

export function deserializzaRevisione<T>(
  statoForm: string,
  inputCalcolo: string,
  risultatoCalcolo: string,
): { stato: T; input: InputCalcolo; risultato: RisultatoCalcolo } {
  return {
    stato: JSON.parse(statoForm) as T,
    input: JSON.parse(inputCalcolo) as InputCalcolo,
    risultato: JSON.parse(risultatoCalcolo) as RisultatoCalcolo,
  }
}
