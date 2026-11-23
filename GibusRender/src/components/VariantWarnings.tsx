import { isMisplaced } from "@/lib/render/placement-threshold";
import { isSceneAltered } from "@/lib/render/scene-check";
import type { VariantInfo } from "@/lib/render/variant-list";

const UNPROTECTED = "Casa non protetta: verificare che nulla sia cambiato";
const ALTERED = "Scena alterata: probabile scarto";
const TRUNCATED = "Pergola forse tagliata: allarga la sagoma e rigenera";
const MISPLACED = "Fuori posto: confronta con il volume";

/** Badge di avviso di una variante completata (pagina del render e pagina del confronto). */
export function VariantWarnings({ v }: { v: VariantInfo }) {
  const altered = isSceneAltered(v.driftScore);
  return (
    <>
      {!v.protected && <p><span className="badge badge-warn">{UNPROTECTED}</span></p>}
      {v.truncated === true && !altered && (
        <p>
          <span
            className="badge badge-warn"
            title="Il modello ha disegnato la pergola oltre l'area che l'app può ricomporre: allarga la sagoma (soprattutto dal lato in cui la pergola si estende) con Duplica e modifica."
          >
            {TRUNCATED}
          </span>
        </p>
      )}
      {isMisplaced(v.placementOffset) && !altered && (
        <p>
          <span
            className="badge badge-warn"
            title={`La zona cambiata dal modello si discosta dal volume disegnato di circa il ${Math.round((v.placementOffset ?? 0) * 100)}% del suo ingombro: attiva "Mostra volume" e controlla posizione e dimensione.`}
          >
            {MISPLACED}
          </span>
        </p>
      )}
      {altered && (
        <p>
          <span
            className="badge badge-warn"
            title={`Il modello ha rifatto la scena fuori dalla sagoma (differenza ${Math.round(v.driftScore ?? 0)} su 255): controlla bene la casa prima di scegliere questa variante.`}
          >
            {ALTERED}
          </span>
        </p>
      )}
    </>
  );
}
