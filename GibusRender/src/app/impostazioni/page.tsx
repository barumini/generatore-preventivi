import { getSettings } from "@/lib/settings";
import { listProviders } from "@/lib/providers/registry";
import { SettingsForm, type ProviderInfo } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function ImpostazioniPage() {
  const settings = await getSettings();
  // Solo dati semplici verso il componente client: i fornitori importano moduli solo-server.
  const providers: ProviderInfo[] = listProviders().map((p) => ({
    id: p.id,
    label: p.label,
    configured: p.isConfigured(),
    suggestedModels: p.suggestedModels,
    supportsMask: p.supportsMask,
  }));

  return (
    <main className="page page-narrow">
      <h1>Impostazioni</h1>
      <p className="muted">Fornitore e modello usati per generare i render. Le chiavi API si impostano solo come variabili d&apos;ambiente.</p>
      <SettingsForm
        providers={providers}
        initial={{
          activeProviderId: settings.activeProviderId,
          activeModel: settings.activeModel,
          quality: settings.quality,
          enabledProviders: settings.enabledProviders,
          defaultVariants: settings.defaultVariants,
        }}
      />
    </main>
  );
}
