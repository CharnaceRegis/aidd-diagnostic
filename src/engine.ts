import { niveauParRank } from "./grille.js";
import type { AxeId, AxeScore, Confiance, Grille, NiveauDefinition } from "./types.js";

export interface ResultatEngine {
  niveauGlobal: NiveauDefinition;
  axeLimitant: AxeId;
  confianceGlobale: Confiance;
}

export function evaluer(
  grille: Grille,
  scores: AxeScore[]
): ResultatEngine {
  if (scores.length === 0) {
    return {
      niveauGlobal: niveauParRank(grille, 0),
      axeLimitant: "taille",
      confianceGlobale: "low",
    };
  }

  const rankMin = Math.min(...scores.map((s) => s.rank));
  const axeLimitant = scores.find((s) => s.rank === rankMin)!.axe;

  return {
    niveauGlobal: niveauParRank(grille, rankMin),
    axeLimitant,
    confianceGlobale: confianceMin(scores.map((s) => s.confiance)),
  };
}

const ORDRE_CONFIANCE: Record<Confiance, number> = {
  high: 2,
  medium: 1,
  low: 0,
};

function confianceMin(confiances: Confiance[]): Confiance {
  const min = Math.min(...confiances.map((c) => ORDRE_CONFIANCE[c]));
  const entry = Object.entries(ORDRE_CONFIANCE).find(([, v]) => v === min);
  return (entry?.[0] as Confiance) ?? "low";
}
