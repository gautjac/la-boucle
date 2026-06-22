import { useState } from "react";

const STEPS = [
  {
    title: "La Boucle",
    body: "Un looper pour apprendre à l'oreille. Charge une toune, isole une phrase, ralentis-la sans changer le ton, pis travaille-la jusqu'à l'avoir dans les mains.",
    accent: "lime" as const,
  },
  {
    title: "Isole la phrase",
    body: "Glisse les poignées A pis B sur l'onde, ou clique pour placer. Zoome avec la molette. La boucle se rejoue sans coupure entre A pis B.",
    accent: "cyan" as const,
  },
  {
    title: "Ralentis, garde le ton",
    body: "Le curseur de vitesse descend jusqu'à 25 % sans toucher à la hauteur. Le décalage (demi-tons) te laisse transposer dans une clé confortable.",
    accent: "lime" as const,
  },
  {
    title: "Monte-la en tempo",
    body: "Le décompte te lance, le compteur de boucles suit ton grind, pis la montée graduelle t'amène de 60 % à 100 % sur N tours. Marque la phrase « réussie » ✓ quand c'est dans les doigts.",
    accent: "cyan" as const,
  },
  {
    title: "Tout reste chez vous",
    body: "Chaque toune pis ses boucles nommées (« intro lick », « pont ») sont sauvées sur ton appareil. « Apprendre l'album » devient une liste de phrases à clouer.",
    accent: "lime" as const,
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const accent = step.accent === "lime" ? "text-lime" : "text-cyan";
  const ring = step.accent === "lime" ? "ring-lime/40" : "ring-cyan/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <div
        className={`w-full max-w-md animate-riseIn rounded-2xl border border-rack-line bg-rack-panel p-7 shadow-panel ring-1 ${ring}`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full transition-all ${
                  k === i
                    ? step.accent === "lime"
                      ? "w-6 bg-lime"
                      : "w-6 bg-cyan"
                    : "w-1.5 bg-rack-line"
                }`}
              />
            ))}
          </div>
          <button
            onClick={onDone}
            className="font-mono text-xs text-steel-dim transition hover:text-steel-bright"
          >
            passer
          </button>
        </div>

        <h2 className={`mb-2 font-sans text-2xl font-extrabold ${accent}`}>
          {step.title}
        </h2>
        <p className="min-h-[5.5rem] text-[15px] leading-relaxed text-steel">
          {step.body}
        </p>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="font-mono text-sm text-steel-dim transition enabled:hover:text-steel-bright disabled:opacity-0"
          >
            ← retour
          </button>
          <button
            onClick={() => (last ? onDone() : setI((v) => v + 1))}
            className={`rounded-lg px-5 py-2.5 font-sans text-sm font-bold text-rack transition active:scale-95 ${
              step.accent === "lime"
                ? "bg-lime shadow-glow hover:bg-lime-glow"
                : "bg-cyan shadow-glow-cyan hover:brightness-110"
            }`}
          >
            {last ? "Commencer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
