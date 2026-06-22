import Dexie, { type Table } from "dexie";

// ---- Local-first store: songs (with the audio blob) + named loop regions ----

export interface Song {
  id: string;
  title: string;
  artist?: string;
  /** original file name */
  fileName: string;
  /** decoded duration in seconds */
  duration: number;
  sampleRate: number;
  /** the actual audio file bytes — so a song survives reloads */
  blob: Blob;
  /** precomputed mono peaks for fast waveform redraw (Float32 min/max pairs) */
  peaks?: number[];
  createdAt: number;
  lastOpenedAt: number;
}

export interface Loop {
  id: string;
  songId: string;
  name: string;
  /** loop in/out points in seconds */
  a: number;
  b: number;
  /** practice speed 0.25–1.0 */
  speed: number;
  /** pitch shift in semitones, -12..12 */
  semitones: number;
  /** gradual speed-up settings */
  ramp?: { from: number; to: number; loops: number };
  countIn: boolean;
  nailed: boolean;
  /** how many times this loop has been practiced (lifetime loop count) */
  reps: number;
  order: number;
  createdAt: number;
}

class BoucleDB extends Dexie {
  songs!: Table<Song, string>;
  loops!: Table<Loop, string>;

  constructor() {
    super("la-boucle");
    this.version(1).stores({
      songs: "id, title, lastOpenedAt, createdAt",
      loops: "id, songId, order, nailed, createdAt",
    });
  }
}

export const db = new BoucleDB();

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
  );
}

// ---- Song operations ----

export async function addSong(s: Omit<Song, "id" | "createdAt" | "lastOpenedAt">): Promise<Song> {
  const now = Date.now();
  const song: Song = { ...s, id: uid(), createdAt: now, lastOpenedAt: now };
  await db.songs.add(song);
  return song;
}

export async function touchSong(id: string): Promise<void> {
  await db.songs.update(id, { lastOpenedAt: Date.now() });
}

export async function deleteSong(id: string): Promise<void> {
  await db.transaction("rw", db.songs, db.loops, async () => {
    await db.loops.where("songId").equals(id).delete();
    await db.songs.delete(id);
  });
}

export async function renameSong(id: string, title: string, artist?: string): Promise<void> {
  await db.songs.update(id, { title, artist });
}

// ---- Loop operations ----

export async function addLoop(
  l: Omit<Loop, "id" | "createdAt" | "order" | "reps" | "nailed">,
): Promise<Loop> {
  const count = await db.loops.where("songId").equals(l.songId).count();
  const loop: Loop = {
    ...l,
    id: uid(),
    order: count,
    reps: 0,
    nailed: false,
    createdAt: Date.now(),
  };
  await db.loops.add(loop);
  return loop;
}

export async function updateLoop(id: string, patch: Partial<Loop>): Promise<void> {
  await db.loops.update(id, patch);
}

export async function deleteLoop(id: string): Promise<void> {
  await db.loops.delete(id);
}

export async function bumpReps(id: string, by = 1): Promise<void> {
  const loop = await db.loops.get(id);
  if (loop) await db.loops.update(id, { reps: loop.reps + by });
}
