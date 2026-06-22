import { useState } from "react";
import { type Loop, updateLoop, deleteLoop } from "../db";
import { fmtTime } from "../lib/format";
import { Check, Trash, Plus, Loop as LoopIcon } from "./Icons";

interface Props {
  loops: Loop[];
  activeLoopId: string | null;
  onLoad: (loop: Loop) => void;
  onSaveCurrent: () => void;
  canSave: boolean;
}

export default function LoopList({
  loops,
  activeLoopId,
  onLoad,
  onSaveCurrent,
  canSave,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const sorted = [...loops].sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-rack-line px-4 py-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-steel">
          Boucles
        </h2>
        <button
          onClick={onSaveCurrent}
          disabled={!canSave}
          className="flex items-center gap-1.5 rounded-md bg-lime/15 px-2.5 py-1.5 font-sans text-xs font-bold text-lime transition enabled:hover:bg-lime/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Garder A–B
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sorted.length === 0 && (
          <p className="px-1 py-6 text-center text-sm leading-relaxed text-steel-dim">
            Place A et B sur une phrase, règle la vitesse,
            <br />
            pis clique « Garder A–B » pour la nommer.
          </p>
        )}
        <ul className="space-y-1.5">
          {sorted.map((l) => {
            const active = l.id === activeLoopId;
            return (
              <li
                key={l.id}
                className={`group rounded-lg border transition ${
                  active
                    ? "border-cyan/50 bg-rack-raised shadow-glow-cyan"
                    : "border-rack-line bg-rack-raised/30 hover:bg-rack-raised/60"
                }`}
              >
                {editId === l.id ? (
                  <form
                    className="flex items-center gap-2 p-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void updateLoop(l.id, { name: editName.trim() || l.name });
                      setEditId(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => {
                        void updateLoop(l.id, { name: editName.trim() || l.name });
                        setEditId(null);
                      }}
                      className="min-w-0 flex-1 rounded bg-rack-deep px-2 py-1 font-sans text-sm text-steel-bright outline-none ring-1 ring-cyan/40"
                    />
                  </form>
                ) : (
                  <div className="flex items-stretch">
                    <button
                      onClick={() =>
                        void updateLoop(l.id, { nailed: !l.nailed })
                      }
                      className="flex items-center pl-2.5 pr-1"
                      aria-label={l.nailed ? "Décocher" : "Marquer réussie"}
                      title={l.nailed ? "Réussie ✓" : "Marquer réussie"}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                          l.nailed
                            ? "border-lime bg-lime text-rack"
                            : "border-rack-line text-transparent hover:border-lime/60"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </button>
                    <button
                      onClick={() => onLoad(l)}
                      onDoubleClick={() => {
                        setEditId(l.id);
                        setEditName(l.name);
                      }}
                      className="flex min-w-0 flex-1 flex-col py-2 pr-2 text-left"
                    >
                      <span
                        className={`truncate font-sans text-sm font-semibold ${
                          l.nailed ? "text-steel-dim line-through" : "text-steel-bright"
                        }`}
                      >
                        {l.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-steel-dim tnum">
                        <span>
                          {fmtTime(l.a)}–{fmtTime(l.b)}
                        </span>
                        <span className="text-cyan-dim">
                          {Math.round(l.speed * 100)}%
                        </span>
                        {l.semitones !== 0 && (
                          <span className="text-ember">
                            {l.semitones > 0 ? "+" : ""}
                            {l.semitones}st
                          </span>
                        )}
                        {l.ramp && <LoopIcon className="h-3 w-3 text-lime-dim" />}
                        {l.reps > 0 && <span>· {l.reps} tours</span>}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer la boucle « ${l.name} » ?`))
                          void deleteLoop(l.id);
                      }}
                      className="shrink-0 px-2 text-steel-dim opacity-0 transition hover:text-ember group-hover:opacity-100"
                      aria-label="Supprimer"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {sorted.length > 0 && (
          <p className="mt-3 px-1 font-mono text-[10px] leading-relaxed text-steel-dim">
            Double-clic pour renommer · clic pour charger
          </p>
        )}
      </div>
    </div>
  );
}
