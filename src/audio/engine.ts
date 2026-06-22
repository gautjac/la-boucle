import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
// Serve the pre-bundled processor from /public via an explicit URL.
// Copied to public/soundtouch-processor.js so it is fetched as a static asset
// (most robust path under Vite for an AudioWorklet module).
const PROCESSOR_URL = "/soundtouch-processor.js";

export interface EngineState {
  playing: boolean;
  /** current playhead in source seconds */
  position: number;
  /** loops completed since play started (for the counter + ramp) */
  loopCount: number;
  /** true while a count-in is ticking */
  countingIn: boolean;
  /** the speed currently applied (may differ from target during ramp) */
  currentSpeed: number;
}

export interface LoopConfig {
  a: number;
  b: number;
  /** target speed 0.25–1.0 */
  speed: number;
  semitones: number;
  countIn: boolean;
  ramp?: { from: number; to: number; loops: number } | null;
  /** loop forever vs play once through B then stop */
  looping: boolean;
}

type Listener = (s: EngineState) => void;

/**
 * The practice looper engine.
 *
 * Tempo is driven by the AudioBufferSourceNode.playbackRate; SoundTouchNode
 * mirrors that rate and auto-compensates pitch so slowing down never changes
 * the key. Pitch shift in semitones rides on top for transposing.
 *
 * Seamless A–B looping: we don't rely on source.loop (which would loop the
 * whole buffer); instead we schedule each pass with an exact playbackRate-aware
 * duration and re-arm a fresh source at A the instant the pass ends.
 */
export class LooperEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private metronome: GainNode | null = null;
  private stNode: SoundTouchNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private registered = false;

  private cfg: LoopConfig = {
    a: 0,
    b: 0,
    speed: 1,
    semitones: 0,
    countIn: false,
    ramp: null,
    looping: true,
  };

  private state: EngineState = {
    playing: false,
    position: 0,
    loopCount: 0,
    countingIn: false,
    currentSpeed: 1,
  };

  private listeners = new Set<Listener>();
  private raf = 0;
  /** ctx.currentTime at which the current pass (from A) started */
  private passStartCtxTime = 0;
  /** the playbackRate of the current pass */
  private passRate = 1;
  private endTimer: number | null = null;

  // ---- lifecycle ----

  async init(buffer: AudioBuffer): Promise<void> {
    this.buffer = buffer;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 1;
      this.gain.connect(this.ctx.destination);
      this.metronome = this.ctx.createGain();
      this.metronome.gain.value = 0.5;
      this.metronome.connect(this.ctx.destination);
    }
    if (!this.registered) {
      await SoundTouchNode.register(this.ctx, PROCESSOR_URL);
      this.registered = true;
    }
  }

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn({ ...this.state });
  }

  setVolume(v: number) {
    if (this.gain) this.gain.gain.value = v;
  }

  // ---- config ----

  setConfig(patch: Partial<LoopConfig>) {
    this.cfg = { ...this.cfg, ...patch };
    // live-apply speed / pitch if playing and not mid count-in
    if (this.state.playing && this.source && this.stNode && !this.state.countingIn) {
      // changing speed mid-pass: recompute the pass timing from current position
      if (patch.speed !== undefined || patch.semitones !== undefined) {
        const pos = this.computePosition();
        this.rearmFrom(pos, false);
      }
    }
  }

  getConfig(): LoopConfig {
    return { ...this.cfg };
  }

  // ---- the speed used for the *current* pass (handles ramp) ----

  private rampedSpeed(): number {
    const r = this.cfg.ramp;
    if (!r || r.loops <= 1) return this.cfg.speed;
    const n = Math.min(this.state.loopCount, r.loops - 1);
    const t = n / (r.loops - 1);
    return r.from + (r.to - r.from) * t;
  }

  // ---- transport ----

  async play(fromA = false) {
    if (!this.ctx || !this.buffer) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (this.state.playing) return;

    const startPos = fromA
      ? this.cfg.a
      : Math.max(this.cfg.a, Math.min(this.state.position, this.cfg.b));

    if (this.cfg.countIn) {
      await this.runCountIn();
    }
    this.state.loopCount = 0;
    this.rearmFrom(startPos, true);
    this.state.playing = true;
    this.emit();
    this.startTicker();
  }

  pause() {
    if (!this.state.playing) return;
    this.state.position = this.computePosition();
    this.teardownSource();
    this.state.playing = false;
    this.state.countingIn = false;
    this.stopTicker();
    this.emit();
  }

  stop() {
    this.teardownSource();
    this.state.playing = false;
    this.state.countingIn = false;
    this.state.loopCount = 0;
    this.state.position = this.cfg.a;
    this.stopTicker();
    this.emit();
  }

  /** jump playhead to A (and keep playing if we were) */
  returnToA() {
    if (this.state.playing) {
      this.rearmFrom(this.cfg.a, false);
    } else {
      this.state.position = this.cfg.a;
    }
    this.emit();
  }

  /** scrub to an absolute position in seconds */
  seek(pos: number) {
    const clamped = Math.max(0, Math.min(pos, this.duration));
    if (this.state.playing) {
      this.rearmFrom(clamped, false);
    } else {
      this.state.position = clamped;
    }
    this.emit();
  }

  // ---- internal: (re)build the source for one pass starting at `pos` ----

  private rearmFrom(pos: number, resetLoopCount: boolean) {
    if (!this.ctx || !this.buffer || !this.gain) return;
    this.teardownSource();
    if (resetLoopCount) this.state.loopCount = 0;

    const rate = this.rampedSpeed();
    this.passRate = rate;
    this.state.currentSpeed = rate;

    // Build: source -> SoundTouchNode -> gain -> destination
    const stNode = new SoundTouchNode({ context: this.ctx });
    stNode.connect(this.gain);
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = rate; // tempo via playback rate
    source.connect(stNode);

    stNode.playbackRate.value = rate; // mirror so processor compensates pitch
    stNode.pitch.value = 1.0;
    stNode.pitchSemitones.value = this.cfg.semitones;

    const startAt = this.ctx.currentTime + 0.02;
    const offset = Math.max(0, Math.min(pos, this.duration));
    const sourceSpan = Math.max(0.02, this.cfg.b - offset); // seconds of audio to play
    source.start(startAt, offset, sourceSpan);

    this.source = source;
    this.stNode = stNode;
    this.passStartCtxTime = startAt;
    // wall-clock duration of this pass at this rate:
    const wallDur = sourceSpan / rate;
    // remember where the pass started in source-seconds for position math
    this.passStartPos = offset;

    this.scheduleEnd(wallDur);
  }

  private passStartPos = 0;

  private scheduleEnd(wallDur: number) {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = window.setTimeout(
      () => this.onPassEnd(),
      Math.max(0, wallDur * 1000 - 4),
    );
  }

  private onPassEnd() {
    if (!this.state.playing) return;
    this.state.loopCount += 1;

    if (!this.cfg.looping) {
      // one-shot: stop at B
      this.stop();
      return;
    }
    // seamless next pass from A (ramp speed recomputed inside rearmFrom)
    this.rearmFrom(this.cfg.a, false);
    this.emit();
  }

  private teardownSource() {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.stNode) {
      try {
        this.stNode.disconnect();
      } catch {
        /* noop */
      }
      this.stNode = null;
    }
  }

  // ---- position computation from ctx clock ----

  private computePosition(): number {
    if (!this.ctx || !this.state.playing) return this.state.position;
    const elapsed = this.ctx.currentTime - this.passStartCtxTime;
    if (elapsed < 0) return this.passStartPos;
    const srcElapsed = elapsed * this.passRate;
    return Math.min(this.cfg.b, this.passStartPos + srcElapsed);
  }

  private startTicker() {
    this.stopTicker();
    const tick = () => {
      if (!this.state.playing) return;
      this.state.position = this.computePosition();
      this.emit();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopTicker() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // ---- count-in: 4 clicks at a sane tempo before the loop fires ----

  private async runCountIn(): Promise<void> {
    if (!this.ctx || !this.metronome) return;
    this.state.countingIn = true;
    this.emit();
    const beat = 0.5; // 120 bpm count-in
    const t0 = this.ctx.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
      this.click(t0 + i * beat, i === 0);
    }
    await new Promise((r) => setTimeout(r, 4 * beat * 1000));
    this.state.countingIn = false;
    this.emit();
  }

  private click(when: number, accent: boolean) {
    if (!this.ctx || !this.metronome) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = accent ? 1320 : 880;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(accent ? 0.9 : 0.5, when + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(env);
    env.connect(this.metronome);
    osc.start(when);
    osc.stop(when + 0.08);
  }

  // ---- one metronome click now (for previewing) ----

  previewClick() {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.click(this.ctx.currentTime + 0.02, true);
  }

  destroy() {
    this.teardownSource();
    this.stopTicker();
    this.listeners.clear();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
