import type { AxeId, AxeScore, Grille, NiveauDefinition } from "./types.js";
import { niveauParRank } from "./grille.js";

export interface ExplicationResult {
  explication: string;
  progression: string;
}

export function expliquerHeuristique(
  grille: Grille,
  scores: AxeScore[],
  niveauGlobal: NiveauDefinition,
  axeLimitant: AxeId
): ExplicationResult {
  const scoreMap = Object.fromEntries(scores.map((s) => [s.axe, s]));
  const axeLim = scoreMap[axeLimitant];
  const niveauSuivant = niveauGlobal.rank < 6
    ? niveauParRank(grille, niveauGlobal.rank + 1)
    : null;

  const axesForts = scores
    .filter((s) => s.rank > niveauGlobal.rank)
    .sort((a, b) => b.rank - a.rank);

  const lignesExplication: string[] = [
    `Niveau global : ${niveauGlobal.label} (rank ${niveauGlobal.rank}).`,
    `L'axe limitant est ${LABELS_AXES[axeLimitant]} (rank ${axeLim.rank}) : ${axeLim.justification}`,
  ];

  if (axesForts.length > 0) {
    const forts = axesForts
      .map((s) => `${LABELS_AXES[s.axe]} (rank ${s.rank})`)
      .join(", ");
    lignesExplication.push(`Points forts : ${forts}.`);
  }

  const lowConf = scores.filter((s) => s.confiance === "low");
  if (lowConf.length > 0) {
    const noms = lowConf.map((s) => LABELS_AXES[s.axe]).join(", ");
    lignesExplication.push(`Confiance faible sur : ${noms}. Données insuffisantes pour un diagnostic précis.`);
  }

  const lignesProgression: string[] = [];

  if (niveauSuivant) {
    lignesProgression.push(
      `Pour atteindre ${niveauSuivant.label} (rank ${niveauSuivant.rank}), l'axe prioritaire est ${LABELS_AXES[axeLimitant]}.`
    );

    const conseil = CONSEILS[axeLimitant]?.[niveauGlobal.rank + 1];
    if (conseil) {
      lignesProgression.push(conseil);
    }

    const autresAxesBas = scores
      .filter((s) => s.axe !== axeLimitant && s.rank <= niveauGlobal.rank)
      .map((s) => s.axe as AxeId);

    if (autresAxesBas.length > 0) {
      const noms = autresAxesBas.map((a) => LABELS_AXES[a]).join(", ");
      lignesProgression.push(
        `Attention aussi à ${noms} qui ${autresAxesBas.length > 1 ? "sont" : "est"} au même niveau et ${autresAxesBas.length > 1 ? "deviendront limitants" : "deviendra limitant"} ensuite.`
      );
    }
  } else {
    lignesProgression.push(
      "Niveau maximum atteint. Consolider en partageant les pratiques avec l'équipe et en documentant les patterns qui marchent."
    );
  }

  return {
    explication: lignesExplication.join("\n"),
    progression: lignesProgression.join("\n"),
  };
}

const LABELS_AXES: Record<AxeId, string> = {
  taille: "Taille",
  harness: "Harness",
  intervention: "Intervention",
  parallele: "En parallèle",
};

const CONSEILS: Record<AxeId, Record<number, string>> = {
  taille: {
    1: "Commencer par utiliser l'IA sur des tâches simples (corrections, boilerplate) pour monter en taille S.",
    2: "Passer à des features de taille M : un composant complet, un endpoint avec ses tests.",
    3: "Viser des features L : une fonctionnalité complète de bout en bout, spec → tests → implémentation.",
    4: "Produire régulièrement des features L-XL avec l'IA, en s'appuyant sur un bon harness pour maintenir la qualité.",
    5: "Continuer à livrer des features L-XL tout en consolidant l'autonomie de l'IA.",
    6: "Maintenir le rythme L-XL avec une autonomie totale de l'IA.",
  },
  harness: {
    1: "Structurer des prompts réutilisables plutôt que de repartir de zéro à chaque session.",
    2: "Mettre en place du context engineering : un CLAUDE.md, des docs d'architecture, un glossaire.",
    3: "Ajouter du behavior : rules pour les conventions, agents spécialisés, skills pour les workflows répétitifs.",
    4: "Affiner le behavior existant et couvrir plus de cas avec des agents et skills dédiés.",
    5: "Mettre en place des boucles automatisées : hooks qui relancent sur erreur, validation automatique.",
    6: "Optimiser les boucles et atteindre une autonomie quasi totale du harness.",
  },
  intervention: {
    1: "Réduire les corrections après coup : mieux cadrer la tâche en amont (contexte, contraintes, exemples).",
    2: "Viser des corrections sur une partie seulement : laisser l'IA gérer les cas standards, intervenir sur les cas limites.",
    3: "Intervenir aux étapes clés uniquement : valider la direction avant implémentation, pas après.",
    4: "Réduire l'intervention aux points de décision architecturale.",
    5: "Cadrer la tâche en amont (spec, contraintes, tests attendus) et ne plus intervenir après.",
    6: "L'IA gère le cadrage aussi : elle lit la spec, pose les bonnes questions, et livre.",
  },
  parallele: {
    1: "Travailler sur un fil à la fois avec l'IA pour construire la confiance.",
    2: "Maintenir un fil principal et commencer à expérimenter un second fil en parallèle.",
    3: "Gérer un fil principal avec des basculements ponctuels sur un second.",
    4: "Passer à 3 fils concurrents : un par agent ou worktree, avec des points de synchronisation.",
    5: "Maintenir 3+ fils en parallèle de façon soutenue.",
    6: "Orchestrer 3+ fils avec une autonomie totale de chaque agent.",
  },
};
