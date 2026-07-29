import { Resend } from "resend";

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY non configurata: impossibile inviare email.");
  }
  return new Resend(apiKey);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const client = getClient();
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const { error } = await client.emails.send({
    from,
    to,
    subject: "Reimposta la tua password — Generatore preventivi",
    html: `
      <p>Hai richiesto di reimpostare la password per il Generatore preventivi DIH Vicenza.</p>
      <p><a href="${resetUrl}">Clicca qui per scegliere una nuova password</a> (link valido 1 ora).</p>
      <p>Se non hai richiesto tu il reset, ignora pure questa email.</p>
    `,
  });

  if (error) {
    throw new Error(`Invio email fallito: ${error.message}`);
  }
}
