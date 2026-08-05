// src/domain/persistenza.ts
import type { InputCalcolo, RisultatoCalcolo } from './calcolo'

export function serializzaRevisione(
  input: InputCalcolo,
  risultato: RisultatoCalcolo,
): { inputCalcolo: string; risultatoCalcolo: string } {
  return {
    inputCalcolo: JSON.stringify(input),
    risultatoCalcolo: JSON.stringify(risultato),
  }
}

export function deserializzaRevisione(
  inputCalcolo: string,
  risultatoCalcolo: string,
): { input: InputCalcolo; risultato: RisultatoCalcolo } {
  return {
    input: JSON.parse(inputCalcolo) as InputCalcolo,
    risultato: JSON.parse(risultatoCalcolo) as RisultatoCalcolo,
  }
}
