"use client";

import { deleteComparison } from "@/lib/render/actions";
import { DeleteButton } from "@/components/DeleteButton";

/** "Elimina confronto" con conferma: toglie tutti i render, le varianti, le foto e le immagini. */
export function DeleteComparisonButton({
  comparisonId,
  clientRef,
  count,
  redirectTo,
  small,
}: {
  comparisonId: string;
  clientRef: string;
  count: number;
  redirectTo?: string;
  small?: boolean;
}) {
  return (
    <DeleteButton
      small={small}
      label="Elimina confronto"
      confirmText={`Eliminare il confronto "${clientRef}" con tutte le sue ${count} finiture, le varianti e le foto? Non si può annullare.`}
      redirectTo={redirectTo}
      action={() => deleteComparison(comparisonId)}
    />
  );
}
