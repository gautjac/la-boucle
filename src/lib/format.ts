/** mm:ss.cs — studio-style timecode */
export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/** parse "m:ss.cs" or seconds back to a number */
export function parseTime(str: string): number | null {
  str = str.trim();
  if (str === "") return null;
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);
  const m = str.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const s = parseInt(m[2], 10);
  const cs = m[3] ? parseInt(m[3].padEnd(2, "0"), 10) : 0;
  return min * 60 + s + cs / 100;
}

export const SPEED_PRESETS = [0.5, 0.65, 0.8, 1.0];

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export function semitoneLabel(n: number): string {
  if (n === 0) return "ton d'origine";
  const sign = n > 0 ? "+" : "−";
  const abs = Math.abs(n);
  return `${sign}${abs} demi-ton${abs > 1 ? "s" : ""}`;
}
export function transposedKeyHint(n: number): string {
  // relative interval name, not absolute key (we don't detect key)
  const idx = ((n % 12) + 12) % 12;
  return NOTE_NAMES[idx];
}
