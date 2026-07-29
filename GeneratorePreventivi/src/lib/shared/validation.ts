import { z } from "zod";

export const catalogItemSchema = z.object({
  description: z.string().trim().min(1, "Descrizione obbligatoria"),
  unitPrice: z.coerce.number().min(0, "Il prezzo non può essere negativo"),
});

export const quoteItemInputSchema = z.object({
  catalogItemId: z.string().nullable(),
  description: z.string().trim().min(1, "Descrizione voce obbligatoria"),
  qty: z.string(),
  unitPrice: z.string(),
});

export const quoteFormSchema = z.object({
  clientId: z.string().min(1, "Seleziona un cliente"),
  title: z.string().trim().min(1, "Titolo obbligatorio"),
  quoteDate: z.string().min(1, "Data obbligatoria"),
  cup: z.string().trim(),
  attivitaProgetto: z.string().trim(),
  scontoPct: z.string(),
  ivaPct: z.string(),
  items: z.array(quoteItemInputSchema).min(1, "Aggiungi almeno una voce"),
});

export const clientSchema = z.object({
  ragioneSociale: z.string().trim().min(1, "Ragione sociale obbligatoria"),
  indirizzo: z.string().trim().optional().or(z.literal("")),
  piva: z.string().trim().optional().or(z.literal("")),
  codiceSdi: z.string().trim().optional().or(z.literal("")),
  referenteDih: z.string().trim().optional().or(z.literal("")),
  codePrefix: z
    .string()
    .trim()
    .min(2, "Almeno 2 caratteri")
    .max(8, "Massimo 8 caratteri")
    .regex(/^[A-Z0-9]+$/, "Solo lettere maiuscole e numeri")
    .optional()
    .or(z.literal("")),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "La password deve avere almeno 8 caratteri")
      .regex(/[a-zA-Z]/, "La password deve contenere almeno una lettera")
      .regex(/[0-9]/, "La password deve contenere almeno un numero"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });
