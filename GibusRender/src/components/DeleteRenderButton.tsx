"use client";

import { deleteRender } from "@/lib/render/actions";
import { DeleteButton } from "@/components/DeleteButton";

/** "Elimina render" con conferma: toglie il render, le varianti, la foto e le immagini. */
export function DeleteRenderButton({
  renderId,
  clientRef,
  redirectTo,
  small,
}: {
  renderId: string;
  clientRef: string;
  redirectTo?: string;
  small?: boolean;
}) {
  return (
    <DeleteButton
      small={small}
      label="Elimina render"
      confirmText={`Eliminare il render "${clientRef}" con tutte le sue varianti e la foto? Non si può annullare.`}
      redirectTo={redirectTo}
      action={() => deleteRender(renderId)}
    />
  );
}
