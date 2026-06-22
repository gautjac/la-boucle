import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteSong, type Song, type Loop } from "../db";
import { Music, Trash, Check, Plus } from "./Icons";

interface Props {
  currentSongId: string | null;
  onPick: (song: Song) => void;
  onAddClick: () => void;
  onClose?: () => void;
}

export default function Library({ currentSongId, onPick, onAddClick, onClose }: Props) {
  const songs = useLiveQuery(
    () => db.songs.orderBy("lastOpenedAt").reverse().toArray(),
    [],
    [] as Song[],
  );
  const loops = useLiveQuery(() => db.loops.toArray(), [], [] as Loop[]);

  const loopsBySong = new Map<string, Loop[]>();
  for (const l of loops) {
    const arr = loopsBySong.get(l.songId) ?? [];
    arr.push(l);
    loopsBySong.set(l.songId, arr);
  }

  return (
    <aside className="flex h-full w-full flex-col bg-rack-panel">
      <div className="flex items-center justify-between border-b border-rack-line px-4 py-3.5">
        <div>
          <h1 className="font-sans text-lg font-extrabold leading-none text-lime">
            La&nbsp;Boucle
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel-dim">
            looper d'oreille
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-steel-dim hover:bg-rack-raised hover:text-steel-bright lg:hidden"
            aria-label="Fermer"
          >
            <Plus className="h-4 w-4 rotate-45" />
          </button>
        )}
      </div>

      <button
        onClick={onAddClick}
        className="mx-3 mt-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-rack-line bg-rack-raised/40 py-2.5 font-sans text-sm font-semibold text-steel transition hover:border-lime/50 hover:text-lime"
      >
        <Plus className="h-4 w-4" />
        Charger une piste
      </button>

      <div className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
        {songs.length === 0 && (
          <p className="px-2 py-8 text-center text-sm leading-relaxed text-steel-dim">
            Aucune piste pour l'instant.
            <br />
            Dépose un fichier audio pour commencer.
          </p>
        )}
        <ul className="space-y-2">
          {songs.map((song) => {
            const sl = (loopsBySong.get(song.id) ?? []).sort((x, y) => x.order - y.order);
            const nailed = sl.filter((l) => l.nailed).length;
            const active = song.id === currentSongId;
            return (
              <li key={song.id}>
                <div
                  className={`group rounded-lg border transition ${
                    active
                      ? "border-lime/50 bg-rack-raised shadow-glow"
                      : "border-rack-line bg-rack-raised/30 hover:bg-rack-raised/60"
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onPick(song)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPick(song);
                      }
                    }}
                    className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-lime/50"
                  >
                    <Music
                      className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-lime" : "text-steel-dim"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-sm font-semibold text-steel-bright">
                        {song.title}
                      </span>
                      {song.artist && (
                        <span className="block truncate font-sans text-xs text-steel-dim">
                          {song.artist}
                        </span>
                      )}
                      <span className="mt-1 flex items-center gap-2 font-mono text-[10px] text-steel-dim">
                        {sl.length > 0 ? (
                          <span className={nailed === sl.length ? "text-lime" : ""}>
                            {nailed}/{sl.length} clouées
                          </span>
                        ) : (
                          <span>aucune boucle</span>
                        )}
                      </span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Supprimer « ${song.title} » et ses boucles ?`))
                          void deleteSong(song.id);
                      }}
                      className="shrink-0 rounded p-1 text-steel-dim opacity-0 transition hover:text-ember group-hover:opacity-100"
                      aria-label="Supprimer"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {active && sl.length > 0 && (
                    <ul className="border-t border-rack-line/60 px-3 py-1.5">
                      {sl.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center gap-2 py-1 font-mono text-[11px]"
                        >
                          <span
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                              l.nailed
                                ? "border-lime bg-lime text-rack"
                                : "border-rack-line text-transparent"
                            }`}
                          >
                            <Check className="h-2.5 w-2.5" />
                          </span>
                          <span
                            className={`truncate ${l.nailed ? "text-steel-dim line-through" : "text-steel"}`}
                          >
                            {l.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
