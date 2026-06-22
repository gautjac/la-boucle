import { fmtTime, parseTime, SPEED_PRESETS, semitoneLabel, clamp } from "../lib/format";
import { Play, Pause, Stop, ToStart, ZoomIn, ZoomOut, Loop as LoopIcon } from "./Icons";
import type { EngineState } from "../audio/engine";

interface RampCfg {
  from: number;
  to: number;
  loops: number;
}

interface Props {
  state: EngineState;
  duration: number;
  a: number;
  b: number;
  speed: number;
  semitones: number;
  countIn: boolean;
  ramp: RampCfg | null;
  onPlayPause: () => void;
  onStop: () => void;
  onReturnA: () => void;
  onSetA: (t: number) => void;
  onSetB: (t: number) => void;
  onSetAtPlayhead: (which: "a" | "b") => void;
  onSpeed: (s: number) => void;
  onSemitones: (n: number) => void;
  onCountIn: (v: boolean) => void;
  onRamp: (r: RampCfg | null) => void;
  onZoom: (dir: "in" | "out" | "fit" | "loop") => void;
}

function Nudge({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="h-6 w-6 rounded bg-rack-raised font-mono text-xs text-steel transition hover:bg-rack-line hover:text-steel-bright active:scale-90"
    >
      {children}
    </button>
  );
}

function TimeField({
  label,
  color,
  value,
  onCommit,
  onNudge,
  onSetHere,
}: {
  label: string;
  color: string;
  value: number;
  onCommit: (t: number) => void;
  onNudge: (delta: number) => void;
  onSetHere: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
        <button
          onClick={onSetHere}
          className="font-mono text-[10px] text-steel-dim underline-offset-2 transition hover:text-steel-bright hover:underline"
          title="Placer au curseur de lecture"
        >
          ← tête
        </button>
      </div>
      <input
        className="numfield w-full rounded-md bg-rack-deep px-2.5 py-2 text-center font-mono text-sm text-steel-bright shadow-well outline-none ring-1 ring-rack-line focus:ring-cyan/50 tnum"
        defaultValue={fmtTime(value)}
        key={value} // re-sync when value changes externally
        onBlur={(e) => {
          const t = parseTime(e.target.value);
          if (t !== null) onCommit(t);
          else e.target.value = fmtTime(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <div className="flex items-center justify-center gap-1.5">
        <Nudge onClick={() => onNudge(-0.5)}>−½</Nudge>
        <Nudge onClick={() => onNudge(-0.05)}>−</Nudge>
        <Nudge onClick={() => onNudge(0.05)}>+</Nudge>
        <Nudge onClick={() => onNudge(0.5)}>+½</Nudge>
      </div>
    </div>
  );
}

export default function Controls({
  state,
  duration,
  a,
  b,
  speed,
  semitones,
  countIn,
  ramp,
  onPlayPause,
  onStop,
  onReturnA,
  onSetA,
  onSetB,
  onSetAtPlayhead,
  onSpeed,
  onSemitones,
  onCountIn,
  onRamp,
  onZoom,
}: Props) {
  const pct = Math.round((state.playing ? state.currentSpeed : speed) * 100);
  const loopLen = Math.max(0, b - a);

  return (
    <div className="flex flex-col gap-5">
      {/* Transport + readout */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onReturnA}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-rack-raised text-steel transition hover:bg-rack-line hover:text-cyan active:scale-95"
            title="Retour à A (R)"
            aria-label="Retour à A"
          >
            <ToStart className="h-5 w-5" />
          </button>
          <button
            onClick={onPlayPause}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-lime text-rack shadow-glow transition hover:bg-lime-glow active:scale-95"
            title="Lecture / Pause (Espace)"
            aria-label="Lecture ou pause"
          >
            {state.playing ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="ml-0.5 h-6 w-6" />
            )}
          </button>
          <button
            onClick={onStop}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-rack-raised text-steel transition hover:bg-rack-line hover:text-ember active:scale-95"
            title="Stop (S)"
            aria-label="Stop"
          >
            <Stop className="h-5 w-5" />
          </button>
        </div>

        {/* big readout */}
        <div className="flex flex-1 items-end gap-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-steel-dim">
              position
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-lime tnum">
              {fmtTime(state.position)}
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="font-mono text-[10px] uppercase tracking-widest text-steel-dim">
              durée boucle
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-steel-bright tnum">
              {fmtTime(loopLen)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-steel-dim">
              vitesse
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-cyan tnum">
              {pct}
              <span className="text-base">%</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-steel-dim">
              tours
            </div>
            <div
              className={`font-mono text-2xl font-bold leading-none tnum ${
                state.countingIn ? "animate-pulseGlow text-ember" : "text-steel-bright"
              }`}
            >
              {state.countingIn ? "•••" : state.loopCount}
            </div>
          </div>
        </div>

        {/* zoom */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onZoom("loop")}
            className="flex h-9 items-center gap-1 rounded-md bg-rack-raised px-2.5 font-mono text-[11px] text-steel transition hover:bg-rack-line hover:text-lime"
            title="Cadrer sur la boucle"
          >
            <LoopIcon className="h-3.5 w-3.5" /> A–B
          </button>
          <button
            onClick={() => onZoom("in")}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-rack-raised text-steel transition hover:bg-rack-line hover:text-steel-bright"
            title="Zoom avant"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => onZoom("out")}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-rack-raised text-steel transition hover:bg-rack-line hover:text-steel-bright"
            title="Zoom arrière"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => onZoom("fit")}
            className="flex h-9 items-center rounded-md bg-rack-raised px-2.5 font-mono text-[11px] text-steel transition hover:bg-rack-line hover:text-steel-bright"
            title="Voir toute la piste"
          >
            tout
          </button>
        </div>
      </div>

      {/* Speed fader + presets */}
      <div className="rounded-xl border border-rack-line bg-rack-panel/60 p-4 shadow-panel">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
            tempo · le ton reste fixe
          </span>
          <div className="flex gap-1.5">
            {SPEED_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => onSpeed(p)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold transition ${
                  Math.abs(speed - p) < 0.005
                    ? "bg-lime text-rack shadow-glow"
                    : "bg-rack-raised text-steel hover:bg-rack-line hover:text-steel-bright"
                }`}
              >
                {Math.round(p * 100)}%
              </button>
            ))}
          </div>
        </div>
        <input
          type="range"
          className="fader w-full"
          min={25}
          max={100}
          step={1}
          value={Math.round(speed * 100)}
          onChange={(e) => onSpeed(Number(e.target.value) / 100)}
          aria-label="Vitesse de lecture"
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-steel-dim">
          <span>25%</span>
          <span>50</span>
          <span>65</span>
          <span>80</span>
          <span>100%</span>
        </div>
      </div>

      {/* A/B + pitch + practice ergonomics grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-rack-line bg-rack-panel/60 p-4 shadow-panel">
          <TimeField
            label="point A"
            color="#22e3d6"
            value={a}
            onCommit={(t) => onSetA(clamp(t, 0, b - 0.05))}
            onNudge={(d) => onSetA(clamp(a + d, 0, b - 0.05))}
            onSetHere={() => onSetAtPlayhead("a")}
          />
        </div>
        <div className="rounded-xl border border-rack-line bg-rack-panel/60 p-4 shadow-panel">
          <TimeField
            label="point B"
            color="#ff7849"
            value={b}
            onCommit={(t) => onSetB(clamp(t, a + 0.05, duration))}
            onNudge={(d) => onSetB(clamp(b + d, a + 0.05, duration))}
            onSetHere={() => onSetAtPlayhead("b")}
          />
        </div>

        {/* Pitch / transpose */}
        <div className="rounded-xl border border-rack-line bg-rack-panel/60 p-4 shadow-panel">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ember">
              transposer
            </span>
            <span className="font-mono text-[11px] text-steel-bright tnum">
              {semitones > 0 ? "+" : ""}
              {semitones}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSemitones(clamp(semitones - 1, -12, 12))}
              className="h-8 w-8 rounded-md bg-rack-raised font-mono text-steel transition hover:bg-rack-line hover:text-steel-bright active:scale-90"
            >
              −
            </button>
            <input
              type="range"
              className="fader cyan flex-1"
              min={-12}
              max={12}
              step={1}
              value={semitones}
              onChange={(e) => onSemitones(Number(e.target.value))}
              aria-label="Décalage en demi-tons"
            />
            <button
              onClick={() => onSemitones(clamp(semitones + 1, -12, 12))}
              className="h-8 w-8 rounded-md bg-rack-raised font-mono text-steel transition hover:bg-rack-line hover:text-steel-bright active:scale-90"
            >
              +
            </button>
          </div>
          <p className="mt-2 text-center font-sans text-[11px] text-steel-dim">
            {semitoneLabel(semitones)}
          </p>
        </div>

        {/* Count-in + ramp */}
        <div className="rounded-xl border border-rack-line bg-rack-panel/60 p-4 shadow-panel">
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
            entraînement
          </span>
          <label className="mt-2.5 flex cursor-pointer items-center justify-between">
            <span className="font-sans text-sm text-steel">Décompte (4)</span>
            <button
              role="switch"
              aria-checked={countIn}
              onClick={() => onCountIn(!countIn)}
              className={`relative h-5 w-9 rounded-full transition ${
                countIn ? "bg-lime" : "bg-rack-raised"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-rack-deep transition-all ${
                  countIn ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </label>
          <label className="mt-3 flex cursor-pointer items-center justify-between">
            <span className="font-sans text-sm text-steel">Montée graduelle</span>
            <button
              role="switch"
              aria-checked={!!ramp}
              onClick={() =>
                onRamp(ramp ? null : { from: 0.6, to: 1.0, loops: 8 })
              }
              className={`relative h-5 w-9 rounded-full transition ${
                ramp ? "bg-cyan" : "bg-rack-raised"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-rack-deep transition-all ${
                  ramp ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </label>
          {ramp && (
            <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-steel-dim tnum">
              <input
                type="number"
                min={25}
                max={95}
                value={Math.round(ramp.from * 100)}
                onChange={(e) =>
                  onRamp({ ...ramp, from: clamp(Number(e.target.value) / 100, 0.25, 0.95) })
                }
                className="numfield w-12 rounded bg-rack-deep px-1 py-1 text-center text-steel-bright outline-none ring-1 ring-rack-line focus:ring-cyan/50"
              />
              <span>→</span>
              <input
                type="number"
                min={30}
                max={100}
                value={Math.round(ramp.to * 100)}
                onChange={(e) =>
                  onRamp({ ...ramp, to: clamp(Number(e.target.value) / 100, 0.3, 1) })
                }
                className="numfield w-12 rounded bg-rack-deep px-1 py-1 text-center text-steel-bright outline-none ring-1 ring-rack-line focus:ring-cyan/50"
              />
              <span>% en</span>
              <input
                type="number"
                min={2}
                max={50}
                value={ramp.loops}
                onChange={(e) =>
                  onRamp({ ...ramp, loops: clamp(Number(e.target.value), 2, 50) })
                }
                className="numfield w-12 rounded bg-rack-deep px-1 py-1 text-center text-steel-bright outline-none ring-1 ring-rack-line focus:ring-cyan/50"
              />
              <span>tours</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
