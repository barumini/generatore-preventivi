"use client";

import {
  DEFAULT_FOCAL_RATIO,
  FOCAL_RATIO_MAX,
  FOCAL_RATIO_MIN,
  MAX_POSTS,
  VOLUME_COLORS,
  type ProjectedVolume,
} from "@/lib/render/volume";
import type { DimsPatch, VolumeTool } from "./VolumeEditor";
import type { RefField, VolumeAction, VolumeDraft } from "./state";

const TOOLS: { id: VolumeTool; label: string }[] = [
  { id: "riquadro", label: "1 · Riquadro" },
  { id: "volume", label: "2 · Volume e montanti" },
  { id: "ritocco", label: "3 · Ritocco fine" },
];

const HINTS: Record<VolumeTool, string> = {
  riquadro:
    "Clicca i quattro angoli di un rettangolo della facciata di cui conosci le misure, per esempio dalla base del muro al filo superiore delle porte. Più è grande, più l'allineamento è preciso. Poi trascina gli angoli per rifinirli: compare una lente.",
  volume:
    "Trascina le maniglie gialle: quella a terra contro il muro sposta il volume, quelle ai lati cambiano la larghezza, quella davanti la sporgenza, quelle in alto le altezze. I pallini blu spostano i montanti lungo il bordo.",
  ritocco:
    "Sposta di poco i singoli angoli del volume per correggere piccoli scarti (terreno non piano, foto storta). Montanti e attacco seguono gli angoli.",
};

/** Campo numerico in mm legato a un valore numerico: scrive solo numeri validi. */
function MmField({
  id,
  label,
  value,
  onChange,
  min = 0,
  step = 10,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label} (mm)</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

/** Cursore della prospettiva: lavora sul logaritmo del rapporto focale, così è simmetrico. */
const toSlider = (ratio: number) => Math.round(Math.log(ratio / FOCAL_RATIO_MIN) / Math.log(FOCAL_RATIO_MAX / FOCAL_RATIO_MIN) * 100);
const fromSlider = (v: number) => FOCAL_RATIO_MIN * Math.pow(FOCAL_RATIO_MAX / FOCAL_RATIO_MIN, v / 100);

/**
 * Campi e comandi del volume 3D, accanto all'editor sulla foto: misure del riquadro,
 * ingombro, montanti, prospettiva e ritocco. Maniglie e campi scrivono lo stesso stato.
 */
export function VolumePanel({
  draft,
  dispatch,
  pv,
  poseError,
  tool,
  onTool,
  onDims,
  freestanding,
  clearHeightMm,
}: {
  draft: VolumeDraft;
  dispatch: (a: VolumeAction) => void;
  pv: ProjectedVolume | null;
  /** Messaggio della geometria quando il volume non si può disegnare. */
  poseError: string | null;
  tool: VolumeTool;
  onTool: (t: VolumeTool) => void;
  onDims: (patch: DimsPatch) => void;
  freestanding: boolean;
  clearHeightMm: number | null;
}) {
  const v = draft.volume;
  const refField = (field: RefField, label: string, placeholder: string) => (
    <div className="field">
      <label htmlFor={field}>{label} (mm)</label>
      <input
        id={field}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={draft[field]}
        placeholder={placeholder}
        onChange={(e) => dispatch({ type: "setRef", field, value: e.target.value })}
      />
    </div>
  );
  const cornersLeft = 4 - draft.corners.length;
  const focal = pv?.focalRatio ?? v?.focalRatio ?? DEFAULT_FOCAL_RATIO;

  return (
    <div>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <div className="segmented" role="group" aria-label="Fase del volume">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tool === t.id}
              disabled={t.id !== "riquadro" && !v}
              onClick={() => onTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tool === "riquadro" && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => dispatch({ type: "resetRef" })}
            disabled={draft.corners.length === 0}
          >
            Rifai il riquadro
          </button>
        )}
        {tool === "ritocco" && (
          <button type="button" className="btn btn-small" onClick={() => dispatch({ type: "clearNudges" })} disabled={!v?.nudges}>
            Azzera ritocchi
          </button>
        )}
      </div>
      <p className="hint muted small">{HINTS[tool]}</p>
      <div className="volume-legend" aria-hidden="true">
        <span><i style={{ borderColor: "#34c759", borderTopStyle: "dashed" }} />riquadro di facciata</span>
        <span><i style={{ borderColor: VOLUME_COLORS.wall }} />attacco a muro</span>
        <span><i style={{ borderColor: VOLUME_COLORS.post }} />montanti</span>
        <span><i style={{ borderColor: "#9a948d", borderTopStyle: "dashed" }} />ingombro</span>
      </div>

      <div className="volume-group">
        <h3>Riquadro di facciata</h3>
        <div className="volume-panel">
          {refField("refWidthMm", "Larghezza reale", "Es. 5200")}
          {refField("refHeightMm", "Altezza reale", "Es. 2400")}
          {refField("refBaseMm", "Quota da terra del lato basso", "0")}
        </div>
        <p className="small muted" role="status">
          {cornersLeft > 0
            ? `Mancano ${cornersLeft} ${cornersLeft === 1 ? "angolo" : "angoli"}: clicca sulla foto.`
            : !v
              ? "Riquadro tracciato: indica larghezza e altezza reali in mm."
              : poseError
                ? poseError
                : pv?.focalAuto
                  ? "Riquadro valido: prospettiva ricavata dalla foto."
                  : "Riquadro valido. La foto è quasi frontale: se la fuga del volume non convince, regola la prospettiva."}
        </p>
      </div>

      {v && (
        <>
          <div className="volume-group">
            <h3>Ingombro</h3>
            <div className="volume-panel">
              <MmField
                id="volOffset"
                label="Scostamento lungo il muro"
                value={v.box.offsetXMm}
                min={-100000}
                onChange={(n) => dispatch({ type: "setBox", patch: { offsetXMm: n } })}
              />
              <MmField
                id="volWallH"
                label={freestanding ? "Altezza sul retro" : "Altezza al muro"}
                value={v.box.wallHeightMm}
                min={500}
                onChange={(n) => {
                  dispatch({ type: "setBox", patch: { wallHeightMm: n } });
                  onDims({ totalHeightMm: n });
                }}
              />
              <MmField
                id="volFrontH"
                label="Altezza sul fronte"
                value={v.box.frontHeightMm}
                min={500}
                onChange={(n) => dispatch({ type: "setBox", patch: { frontHeightMm: n } })}
              />
              {freestanding && (
                <MmField
                  id="volDistance"
                  label="Distanza dal muro"
                  value={v.box.distanceMm}
                  onChange={(n) => dispatch({ type: "setBox", patch: { distanceMm: n } })}
                />
              )}
            </div>
            <p className="small muted">
              Larghezza e sporgenza sono quelle delle Misure (passo 3): cambiano insieme al disegno.{" "}
              {freestanding ? "L'altezza sul retro" : "L'altezza al muro"} è l&apos;Altezza totale.
            </p>
            {clearHeightMm !== null && clearHeightMm > v.box.frontHeightMm && (
              <div className="banner-warn" role="status">
                L&apos;altezza utile ({clearHeightMm} mm) supera l&apos;altezza sul fronte ({v.box.frontHeightMm} mm): controlla le misure.
              </div>
            )}
            {pv?.outOfFrame && (
              <div className="banner-warn" role="status">
                Il volume esce dall&apos;inquadratura: la parte fuori dalla foto non potrà essere disegnata.
              </div>
            )}
          </div>

          <div className="volume-group">
            <h3>Montanti</h3>
            <div className="volume-panel">
              <div className="field">
                <label htmlFor="volFrontPosts">Montanti sul fronte</label>
                <input
                  id="volFrontPosts"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_POSTS}
                  step={1}
                  value={v.frontPosts.length}
                  onChange={(e) => dispatch({ type: "setPostCount", rear: false, count: Number(e.target.value) || 0 })}
                />
              </div>
              {freestanding && (
                <div className="field">
                  <label htmlFor="volRearPosts">Montanti sul retro</label>
                  <input
                    id="volRearPosts"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_POSTS}
                    step={1}
                    value={v.rearPosts.length}
                    onChange={(e) => dispatch({ type: "setPostCount", rear: true, count: Number(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>
            <p className="small muted">
              Cambiando il numero i montanti si ridistribuiscono; poi trascinali sulla foto. Il numero accanto a ciascuno è la
              distanza in mm dall&apos;estremo sinistro.
            </p>
          </div>

          <div className="volume-group">
            <h3>Prospettiva</h3>
            <div className="range-row">
              <span className="small muted">grandangolo</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={toSlider(focal)}
                aria-label="Prospettiva: da grandangolo a tele"
                onChange={(e) => dispatch({ type: "setFocal", ratio: fromSlider(Number(e.target.value)) })}
              />
              <span className="small muted">tele</span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => dispatch({ type: "setFocal", ratio: null })}
                disabled={v.focalRatio === null}
              >
                Automatica
              </button>
            </div>
            <p className="small muted">
              {v.focalRatio === null ? "Automatica" : "Regolata a mano"}: cambia quanto il volume &ldquo;fugge&rdquo; in
              profondità. La facciata resta ferma sul riquadro.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
