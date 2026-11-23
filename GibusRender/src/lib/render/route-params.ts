import { z } from "zod";

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Valida l'id dei parametri di route (Next 16: params è una Promise). */
export async function routeId(params: Promise<{ id: string }>): Promise<string | null> {
  const r = idSchema.safeParse((await params)?.id);
  return r.success ? r.data : null;
}
