import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  addSong,
  addLoop,
  touchSong,
  type Song,
  type Loop,
} from "./db";
import { LooperEngine, type EngineState, type LoopConfig } from "./audio/engine";
import { decodeBlob, isAudioFile, ACCEPTED } from "./audio/decode";
import { clamp } from "./lib/format";
import Library from "./components/Library";
import LoopList from "./components/LoopList";
import Controls from "./components/Controls";
import Waveform from "./components/Waveform";
import Onboarding from "./components/Onboarding";
import { Upload, Music } from "./components/Icons";

interface RampCfg {
  from: number;
  to: number;
  loops: number;
}

const ONBOARD_KEY = "la-boucle:onboarded";

export default function App() {
  const engineRef = useRef<LooperEngine | null>(null);
  if (!engineRef.current) engineRef.current = new LooperEngine();
  const engine = engineRef.current;

  const [song, setSong] = useState<Song | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // loop / playback config
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [semitones, setSemitones] = useState(0);
  const [countIn, setCountIn] = useState(false);
  const [ramp, setRamp] = useState<RampCfg | null>(null);
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null);

  // view window (zoom)
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(0);

  const [engineState, setEngineState] = useState<EngineState>({
    playing: false,
    position: 0,
    loopCount: 0,
    countingIn: false,
    currentSpeed: 1,
  });

  const [showOnboard, setShowOnboard] = useState(
    () => !localStorage.getItem(ONBOARD_KEY),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loops = useLiveQuery(
    () =>
      song
        ? db.loops.where("songId").equals(song.id).toArray()
        : Promise.resolve([] as Loop[]),
    [song?.id],
    [] as Loop[],
  );

  // subscribe to engine state
  useEffect(() => {
    return engine.subscribe(setEngineState);
  }, [engine]);

  // push config to engine whenever it changes
  useEffect(() => {
    const cfg: Partial<LoopConfig> = {
      a,
      b,
      speed,
      semitones,
      countIn,
      ramp: ramp ?? null,
      looping: true,
    };
    engine.setConfig(cfg);
  }, [engine, a, b, speed, semitones, countIn, ramp]);

  // ---- load a decoded buffer into the engine ----
  const loadSong = useCallback(
    async (s: Song, decoded?: { buffer: AudioBuffer; peaks: number[] }) => {
      setLoading(true);
      setLoadError(null);
      try {
        const dec = decoded ?? (await decodeBlob(s.blob));
        await engine.init(dec.buffer);
        engine.stop();
        setSong(s);
        setPeaks(s.peaks && s.peaks.length ? s.peaks : dec.peaks);
        setDuration(dec.buffer.duration);
        // default loop = whole track if none chosen
        const newA = 0;
        const newB = dec.buffer.duration;
        setA(newA);
        setB(newB);
        setSpeed(1);
        setSemitones(0);
        setActiveLoopId(null);
        setViewStart(0);
        setViewEnd(dec.buffer.duration);
        void touchSong(s.id);
      } catch (err) {
        console.error(err);
        setLoadError(
          "Impossible de décoder ce fichier audio. Essaie un MP3, M4A, WAV ou FLAC.",
        );
      } finally {
        setLoading(false);
      }
    },
    [engine],
  );

  // ---- ingest a new file ----
  const ingestFile = useCallback(
    async (file: File) => {
      if (!isAudioFile(file)) {
        setLoadError("Ce fichier n'est pas un audio reconnu.");
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const decoded = await decodeBlob(file);
        const title = file.name.replace(/\.[^.]+$/, "");
        const saved = await addSong({
          title,
          fileName: file.name,
          duration: decoded.buffer.duration,
          sampleRate: decoded.buffer.sampleRate,
          blob: file,
          peaks: decoded.peaks,
        });
        await loadSong(saved, decoded);
        setSidebarOpen(false);
      } catch (err) {
        console.error(err);
        setLoadError(
          "Impossible de décoder ce fichier audio. Essaie un MP3, M4A, WAV ou FLAC.",
        );
        setLoading(false);
      }
    },
    [loadSong],
  );

  // ---- drag & drop on the whole window ----
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) setDragOver(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void ingestFile(file);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [ingestFile]);

  // ---- transport actions ----
  const playPause = useCallback(() => {
    if (!song) return;
    if (engineState.playing) engine.pause();
    else void engine.play(false);
  }, [engine, engineState.playing, song]);

  const stop = useCallback(() => engine.stop(), [engine]);
  const returnA = useCallback(() => engine.returnToA(), [engine]);

  const handleScrub = useCallback(
    (t: number) => engine.seek(t),
    [engine],
  );

  // ---- A/B setters that respect bounds ----
  const setAClamped = useCallback(
    (t: number) => setA(clamp(t, 0, b - 0.05)),
    [b],
  );
  const setBClamped = useCallback(
    (t: number) => setB(clamp(t, a + 0.05, duration || t)),
    [a, duration],
  );
  const setAtPlayhead = useCallback(
    (which: "a" | "b") => {
      const t = engineState.position;
      if (which === "a") setAClamped(t);
      else setBClamped(t);
    },
    [engineState.position, setAClamped, setBClamped],
  );

  // ---- zoom ----
  const handleZoom = useCallback(
    (dir: "in" | "out" | "fit" | "loop") => {
      if (duration <= 0) return;
      if (dir === "fit") {
        setViewStart(0);
        setViewEnd(duration);
        return;
      }
      if (dir === "loop") {
        const pad = Math.max(0.15, (b - a) * 0.15);
        setViewStart(Math.max(0, a - pad));
        setViewEnd(Math.min(duration, b + pad));
        return;
      }
      const span = viewEnd - viewStart;
      const center = (viewStart + viewEnd) / 2;
      const factor = dir === "in" ? 1 / 1.6 : 1.6;
      const newSpan = clamp(span * factor, Math.min(0.25, duration), duration);
      let vs = center - newSpan / 2;
      let ve = center + newSpan / 2;
      if (vs < 0) {
        vs = 0;
        ve = newSpan;
      }
      if (ve > duration) {
        ve = duration;
        vs = duration - newSpan;
      }
      setViewStart(Math.max(0, vs));
      setViewEnd(Math.min(duration, ve));
    },
    [a, b, duration, viewStart, viewEnd],
  );

  // ---- save current A/B as a named loop ----
  const saveCurrentLoop = useCallback(async () => {
    if (!song) return;
    const name = prompt(
      "Nom de la boucle (ex. « intro lick », « pont ») :",
      `Boucle ${(loops?.length ?? 0) + 1}`,
    );
    if (name === null) return;
    const created = await addLoop({
      songId: song.id,
      name: name.trim() || `Boucle ${(loops?.length ?? 0) + 1}`,
      a,
      b,
      speed,
      semitones,
      countIn,
      ramp: ramp ?? undefined,
    });
    setActiveLoopId(created.id);
  }, [song, a, b, speed, semitones, countIn, ramp, loops]);

  // ---- load a saved loop ----
  const loadLoop = useCallback(
    (l: Loop) => {
      setA(l.a);
      setB(l.b);
      setSpeed(l.speed);
      setSemitones(l.semitones);
      setCountIn(l.countIn);
      setRamp(l.ramp ?? null);
      setActiveLoopId(l.id);
      const pad = Math.max(0.15, (l.b - l.a) * 0.15);
      setViewStart(Math.max(0, l.a - pad));
      setViewEnd(Math.min(duration || l.b, l.b + pad));
      engine.seek(l.a);
      // count this practice session
      void db.loops.get(l.id).then((cur) => {
        if (cur) void db.loops.update(l.id, { reps: cur.reps + 1 });
      });
    },
    [duration, engine],
  );

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          playPause();
          break;
        case "r":
        case "R":
          returnA();
          break;
        case "s":
        case "S":
          stop();
          break;
        case "a":
        case "A":
          setAtPlayhead("a");
          break;
        case "b":
        case "B":
          setAtPlayhead("b");
          break;
        case "ArrowUp":
          e.preventDefault();
          setSpeed((s) => clamp(Math.round((s + 0.05) * 100) / 100, 0.25, 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed((s) => clamp(Math.round((s - 0.05) * 100) / 100, 0.25, 1));
          break;
        case "ArrowLeft":
          engine.seek(Math.max(a, engineState.position - 1));
          break;
        case "ArrowRight":
          engine.seek(Math.min(b, engineState.position + 1));
          break;
        case "+":
        case "=":
          handleZoom("in");
          break;
        case "-":
          handleZoom("out");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playPause, returnA, stop, setAtPlayhead, handleZoom, engine, a, b, engineState.position]);

  const dismissOnboard = () => {
    localStorage.setItem(ONBOARD_KEY, "1");
    setShowOnboard(false);
  };

  const hasSong = !!song;
  const speedForUi = useMemo(() => speed, [speed]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-rack text-steel-bright">
      {showOnboard && <Onboarding onDone={dismissOnboard} />}

      {/* drag overlay */}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-rack/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-lime px-12 py-10 text-lime shadow-glow">
            <Upload className="h-10 w-10" />
            <span className="font-sans text-lg font-bold">Dépose ta piste</span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ingestFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex min-h-0 flex-1">
        {/* sidebar (desktop) */}
        <div className="hidden w-72 shrink-0 border-r border-rack-line lg:block">
          <Library
            currentSongId={song?.id ?? null}
            onPick={(s) => void loadSong(s)}
            onAddClick={() => fileInputRef.current?.click()}
          />
        </div>

        {/* sidebar (mobile drawer) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] border-r border-rack-line shadow-panel">
              <Library
                currentSongId={song?.id ?? null}
                onPick={(s) => {
                  void loadSong(s);
                  setSidebarOpen(false);
                }}
                onAddClick={() => fileInputRef.current?.click()}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        {/* main */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* mobile header */}
          <div className="flex items-center justify-between border-b border-rack-line px-4 py-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-2 font-sans text-sm font-semibold text-steel"
            >
              <Music className="h-4 w-4 text-lime" />
              Bibliothèque
            </button>
            <span className="font-sans text-base font-extrabold text-lime">
              La Boucle
            </span>
          </div>

          {!hasSong ? (
            <EmptyState
              onPick={() => fileInputRef.current?.click()}
              loading={loading}
              error={loadError}
            />
          ) : (
            <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
              {/* now playing */}
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-sans text-xl font-extrabold text-steel-bright md:text-2xl">
                    {song!.title}
                  </h2>
                  {song!.artist && (
                    <p className="truncate font-sans text-sm text-steel-dim">
                      {song!.artist}
                    </p>
                  )}
                </div>
                {activeLoopId && loops && (
                  <span className="shrink-0 rounded-full bg-cyan/15 px-3 py-1 font-mono text-[11px] text-cyan">
                    {loops.find((l) => l.id === activeLoopId)?.name}
                  </span>
                )}
              </div>

              {loadError && (
                <div className="rounded-lg border border-ember/40 bg-ember/10 px-4 py-2.5 text-sm text-ember">
                  {loadError}
                </div>
              )}

              {/* waveform */}
              <div className="h-44 md:h-56">
                <Waveform
                  peaks={peaks}
                  duration={duration}
                  a={a}
                  b={b}
                  position={engineState.position}
                  viewStart={viewStart}
                  viewEnd={viewEnd}
                  onSetA={setAClamped}
                  onSetB={setBClamped}
                  onScrub={handleScrub}
                  onViewChange={(s, e) => {
                    setViewStart(s);
                    setViewEnd(e);
                  }}
                />
              </div>

              <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
                <Controls
                  state={engineState}
                  duration={duration}
                  a={a}
                  b={b}
                  speed={speedForUi}
                  semitones={semitones}
                  countIn={countIn}
                  ramp={ramp}
                  onPlayPause={playPause}
                  onStop={stop}
                  onReturnA={returnA}
                  onSetA={setAClamped}
                  onSetB={setBClamped}
                  onSetAtPlayhead={setAtPlayhead}
                  onSpeed={(s) => setSpeed(clamp(s, 0.25, 1))}
                  onSemitones={setSemitones}
                  onCountIn={setCountIn}
                  onRamp={setRamp}
                  onZoom={handleZoom}
                />

                <div className="rounded-xl border border-rack-line bg-rack-panel/60 shadow-panel xl:max-h-[460px]">
                  <LoopList
                    loops={loops ?? []}
                    activeLoopId={activeLoopId}
                    onLoad={loadLoop}
                    onSaveCurrent={() => void saveCurrentLoop()}
                    canSave={hasSong && b - a > 0.05}
                  />
                </div>
              </div>

              <ShortcutBar />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  loading,
  error,
}: {
  onPick: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <button
        onClick={onPick}
        disabled={loading}
        className="group flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-rack-line px-12 py-14 transition hover:border-lime/50"
      >
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-rack-panel shadow-panel transition group-hover:shadow-glow">
          {loading ? (
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-lime/30 border-t-lime" />
          ) : (
            <Upload className="h-9 w-9 text-lime" />
          )}
        </span>
        <span className="font-sans text-lg font-bold text-steel-bright">
          {loading ? "Décodage…" : "Charge une piste"}
        </span>
        <span className="max-w-xs font-sans text-sm leading-relaxed text-steel-dim">
          Glisse-dépose un fichier audio (MP3, M4A, WAV, FLAC) ou clique pour
          choisir. Tout reste sur ton appareil.
        </span>
      </button>
      {error && (
        <p className="mt-5 max-w-sm rounded-lg border border-ember/40 bg-ember/10 px-4 py-2.5 text-sm text-ember">
          {error}
        </p>
      )}
    </div>
  );
}

function ShortcutBar() {
  const keys: [string, string][] = [
    ["Espace", "lecture/pause"],
    ["R", "retour à A"],
    ["S", "stop"],
    ["A / B", "placer A / B"],
    ["↑ ↓", "vitesse"],
    ["← →", "± 1 s"],
    ["+ −", "zoom"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-rack-line/60 pt-3 font-mono text-[10px] text-steel-dim">
      {keys.map(([k, d]) => (
        <span key={k} className="flex items-center gap-1.5">
          <kbd className="rounded bg-rack-raised px-1.5 py-0.5 text-steel">{k}</kbd>
          {d}
        </span>
      ))}
    </div>
  );
}
