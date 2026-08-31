import { niveauParRank } from "./grille.js";
import type { AxeId, AxeScore, Confiance, Grille, NiveauDefinition } from "./types.js";

export interface ResultatEngine {
  niveauGlobal: NiveauDefinition;
  axeLimitant: AxeId;
  confianceGlobale: Confiance;
  warnings: string[];
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
      warnings: [],
    };
  }

  const rankMin = Math.min(...scores.map((s) => s.rank));
  const axeLimitant = scores.find((s) => s.rank === rankMin)!.axe;
  const warnings = detecterIncoherences(scores);

  return {
    niveauGlobal: niveauParRank(grille, rankMin),
    axeLimitant,
    confianceGlobale: confianceMin(scores.map((s) => s.confiance)),
    warnings,
  };
}

export const LABELS_AXES: Record<AxeId, string> = {
  taille: "Taille",
  harness: "Harness",
  intervention: "Intervention",
  parallele: "En parallèle",
};

const INCOHERENCES: { haut: AxeId; bas: AxeId; message: string }[] = [
  { haut: "harness", bas: "intervention",
    message: "l'outillage est en place mais l'intervention reste massive" },
  { haut: "taille", bas: "parallele",
    message: "grosses features mais pas de travail en parallèle" },
  { haut: "intervention", bas: "harness",
    message: "autonome mais sans filet d'outillage structuré" },
];

function detecterIncoherences(scores: AxeScore[]): string[] {
  const parAxe = Object.fromEntries(scores.map((s) => [s.axe, s.rank])) as Record<AxeId, number>;
  const warnings: string[] = [];

  for (const { haut, bas, message } of INCOHERENCES) {
    const rHaut = parAxe[haut];
    const rBas = parAxe[bas];
    if (rHaut === undefined || rBas === undefined) continue;
    if (rHaut - rBas > 3) {
      warnings.push(`${LABELS_AXES[haut]} (rank ${rHaut}) très supérieur à ${LABELS_AXES[bas]} (rank ${rBas}) — ${message}`);
    }
  }

  return warnings;
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
