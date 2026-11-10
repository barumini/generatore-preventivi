"use client";

import { DeleteButton } from "@/components/DeleteButton";
import { deleteProduct } from "@/lib/catalog/actions";

export function DeleteProduct({ id, name }: { id: string; name: string }) {
  return (
    <DeleteButton
      label="Elimina prodotto"
      confirmText={`Eliminare "${name}"? I render già creati restano nell'archivio con nome e misure.`}
      action={() => deleteProduct(id)}
      redirectTo="/catalogo"
    />
  );
}
