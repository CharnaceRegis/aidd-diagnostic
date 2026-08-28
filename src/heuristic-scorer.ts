import type {
  AxeId,
  AxeScore,
  Confiance,
  Grille,
  Profil,
  ProfilPieces,
  RepoContextSummary,
} from "./types.js";

export function scorerProfilHeuristique(
  grille: Grille,
  profil: Profil
): AxeScore[] {
  return grille.axes.map((axe) => {
    const id = axe.id as AxeId;
    const scoreFn = SCORERS[id];
    return scoreFn(profil.pieces);
  });
}

type ScorerFn = (pieces: ProfilPieces) => AxeScore;

const SCORERS: Record<AxeId, ScorerFn> = {
  taille: scoreTaille,
  harness: scoreHarness,
  intervention: scoreIntervention,
  parallele: scoreParallele,
};

// --- Taille ---

function scoreTaille(pieces: ProfilPieces): AxeScore {
  const ga = pieces.gitActivity;
  if (!ga) {
    return axeScore("taille", 0, "Pas de données d'activité git.", "low");
  }

  const commits = ga["commits"] as Record<string, unknown> | undefined;
  const aiRatio = (commits?.["ai_coauthored_ratio"] as number) ?? 0;
  const pr = ga["pull_requests"] as Record<string, unknown> | undefined;

  if (!pr) {
    return axeScore("taille", 0, "Pas de données de pull requests.", "low");
  }

  const dist = pr["size_distribution"] as Record<string, number> | undefined;
  if (!dist) {
    return axeScore("taille", 0, "Pas de distribution de taille.", "low");
  }

  // Taille dominante des PR (médiane pondérée)
  const tailleDominante = taillePRDominante(dist);

  // Si l'IA est à peine utilisée, la taille des features IA est limitée
  if (aiRatio < 0.05) {
    return axeScore("taille", Math.min(tailleDominante, 1),
      `Ratio IA très faible (${pct(aiRatio)}). L'IA est utilisée ponctuellement, les features IA restent petites.`,
      "high");
  }

  if (aiRatio < 0.3) {
    return axeScore("taille", Math.min(tailleDominante, 2),
      `Ratio IA modéré (${pct(aiRatio)}). L'IA contribue mais pas sur les plus grosses features.`,
      "medium");
  }

  // IA bien intégrée, la taille des PR reflète la taille des features IA
  return axeScore("taille", tailleDominante,
    `Ratio IA élevé (${pct(aiRatio)}), taille dominante des PR : ${TAILLE_LABELS[tailleDominante]}.`,
    "high");
}

const TAILLE_LABELS: Record<number, string> = {
  0: "aucune", 1: "S", 2: "M", 3: "L", 4: "L-XL", 5: "L-XL", 6: "L-XL",
};

/** Détermine le rank de taille à partir de la distribution des PR */
function taillePRDominante(dist: Record<string, number>): number {
  const xs = dist["xs"] ?? 0;
  const s = dist["s"] ?? 0;
  const m = dist["m"] ?? 0;
  const l = dist["l"] ?? 0;
  const xl = dist["xl"] ?? 0;
  const total = xs + s + m + l + xl;
  if (total === 0) return 0;

  // Pourcentage cumulé depuis les plus grosses
  const pctLXL = (l + xl) / total;
  const pctMLXL = (m + l + xl) / total;

  if (pctLXL >= 0.5) return xl > l ? 5 : 4; // L-XL dominant
  if (pctLXL >= 0.3) return 3; // L significatif
  if (pctMLXL >= 0.5) return 2; // M dominant
  if ((s + xs) / total > 0.7) return 1; // S dominant
  return 1;
}

// --- Harness ---

function scoreHarness(pieces: ProfilPieces): AxeScore {
  const ga = pieces.gitActivity;
  const cf = ga?.["context_files"] as Record<string, unknown> | undefined;
  const au = ga?.["assistant_usage"] as Record<string, unknown> | undefined;
  const rc = pieces.repoContext;

  // Pas d'usage IA du tout
  if (!au && !cf && !rc) {
    return axeScore("harness", 0, "Aucune trace d'outillage IA.", "medium");
  }

  // Compter ce qui est en place
  const aBoucles = hasBoucles(rc, cf);
  const aBehavior = hasBehavior(rc, cf);
  const aContextEng = hasContextEngineering(rc, cf);
  const aPrompts = hasPrompts(au);

  if (aBoucles) {
    return axeScore("harness", 5,
      "Hooks ou boucles automatisées détectés en plus du context engineering et du behavior.",
      "high");
  }
  if (aBehavior) {
    // Ranks 3 et 4 = même valeur dans l'échelle. Différencier par la densité.
    const depth = behaviorDepth(rc, cf);
    const rank = depth >= 4 ? 4 : 3;
    return axeScore("harness", rank,
      `Context engineering et behavior en place (${depth} éléments de behavior : rules, agents, skills).`,
      "high");
  }
  if (aContextEng) {
    return axeScore("harness", 2,
      "Context engineering en place (CLAUDE.md, docs de contexte) mais pas de behavior structuré.",
      "high");
  }
  if (aPrompts) {
    return axeScore("harness", 1,
      "Utilise un outil IA mais sans fichiers de contexte structurés.",
      "medium");
  }

  return axeScore("harness", 0, "Pas d'outillage IA détecté.", "medium");
}

function hasPrompts(au: Record<string, unknown> | undefined): boolean {
  if (!au) return false;
  const tools = au["declared_tools"] as string[] | undefined;
  return (tools?.length ?? 0) > 0;
}

function hasContextEngineering(
  rc: RepoContextSummary | null,
  cf: Record<string, unknown> | undefined
): boolean {
  if (rc?.claudeMd) return true;
  if (rc?.agentsMd) return true;
  if (rc && rc.docsFiles.length > 0) return true;
  if (cf?.["agents_md"] === true) return true;
  return false;
}

function hasBehavior(
  rc: RepoContextSummary | null,
  cf: Record<string, unknown> | undefined
): boolean {
  if (!hasContextEngineering(rc, cf)) return false;

  const rulesCount = (cf?.["rules_count"] as number) ?? 0;
  const agentsCount = (cf?.["agents_count"] as number) ?? 0;
  const skillsCount = (cf?.["skills_count"] as number) ?? 0;

  if (rulesCount > 0 || agentsCount > 0 || skillsCount > 0) return true;
  if (rc && (rc.ruleFiles.length > 0 || rc.agentFiles.length > 0 || rc.skillFiles.length > 0)) return true;

  return false;
}

/** Nombre total d'éléments de behavior (rules + agents + skills) */
function behaviorDepth(
  rc: RepoContextSummary | null,
  cf: Record<string, unknown> | undefined
): number {
  const fromCf =
    ((cf?.["rules_count"] as number) ?? 0) +
    ((cf?.["agents_count"] as number) ?? 0) +
    ((cf?.["skills_count"] as number) ?? 0);
  const fromRc = rc
    ? rc.ruleFiles.length + rc.agentFiles.length + rc.skillFiles.length
    : 0;
  return Math.max(fromCf, fromRc);
}

function hasBoucles(
  rc: RepoContextSummary | null,
  cf: Record<string, unknown> | undefined
): boolean {
  if (!hasBehavior(rc, cf)) return false;

  const hooksCount = (cf?.["hooks_count"] as number) ?? 0;
  if (hooksCount > 0) return true;
  if (rc && rc.hookFiles.length > 0) return true;

  return false;
}

// --- Intervention ---

function scoreIntervention(pieces: ProfilPieces): AxeScore {
  const ga = pieces.gitActivity;
  if (!ga) {
    return axeScore("intervention", 0, "Pas de données d'activité git.", "low");
  }

  const pr = ga["pull_requests"] as Record<string, unknown> | undefined;
  if (!pr) {
    return axeScore("intervention", 0, "Pas de données de pull requests.", "low");
  }

  const total = (pr["total"] as number) ?? 0;
  const correctionMedian = (pr["median_correction_commits_after_open"] as number) ?? 0;
  const mergedNoEdit = (pr["merged_without_human_edit_after_open"] as number) ?? 0;
  const reverted = (pr["reverted"] as number) ?? 0;

  const ci = ga["ci"] as Record<string, unknown> | undefined;
  const failureRate = (ci?.["failure_rate"] as number) ?? 0;
  const runsToGreen = (ci?.["median_runs_to_green"] as number) ?? 1;

  // Ratio de PR mergées sans édition humaine
  const autonomieRatio = total > 0 ? mergedNoEdit / total : 0;
  const revertRatio = total > 0 ? reverted / total : 0;

  // Confiance dégradée sans session.md
  const confiance: Confiance = pieces.session ? "high" : "medium";

  // Beaucoup de corrections après ouverture + reverts = intervention massive
  if (correctionMedian >= 4 || revertRatio > 0.05) {
    return axeScore("intervention", 1,
      `Corrections fréquentes après ouverture (médiane: ${correctionMedian}) et ${reverted} PR revertées. Intervention systématique après coup.`,
      confiance);
  }

  // Corrections modérées
  if (correctionMedian >= 2 || failureRate > 0.2) {
    return axeScore("intervention", 2,
      `Corrections après ouverture (médiane: ${correctionMedian}), taux d'échec CI ${pct(failureRate)}. Intervention partielle après coup.`,
      confiance);
  }

  // Peu de corrections, autonomie correcte
  if (correctionMedian <= 1 && failureRate <= 0.1) {
    if (autonomieRatio >= 0.5 && runsToGreen <= 1) {
      return axeScore("intervention", 5,
        `${pct(autonomieRatio)} des PR mergées sans édition humaine, CI verte du premier coup. Intervention minimale une fois la tâche cadrée.`,
        confiance);
    }
    if (autonomieRatio >= 0.25) {
      // Rank 4 si le ratio est solide, ou si le volume absolu compense un ratio plus bas
      const rank = autonomieRatio >= 0.35 || mergedNoEdit >= 40 ? 4 : 3;
      return axeScore("intervention", rank,
        `Corrections faibles (médiane: ${correctionMedian}), ${pct(autonomieRatio)} mergées sans édition (${mergedNoEdit} PR). Intervention aux étapes clés.`,
        confiance);
    }
  }

  // Corrections légères ou autonomie partielle
  if (correctionMedian <= 2) {
    return axeScore("intervention", 2,
      `Corrections modérées (médiane: ${correctionMedian}), autonomie ${pct(autonomieRatio)}. Intervention après coup sur une partie.`,
      confiance);
  }

  // Cas résiduel
  return axeScore("intervention", 1,
    `Corrections fréquentes (médiane: ${correctionMedian}), autonomie ${pct(autonomieRatio)}. Intervention systématique.`,
    confiance);
}

// --- Parallèle ---

function scoreParallele(pieces: ProfilPieces): AxeScore {
  const ga = pieces.gitActivity;
  if (!ga) {
    return axeScore("parallele", 0, "Pas de données d'activité git.", "low");
  }

  const par = ga["parallelism"] as Record<string, unknown> | undefined;
  if (!par) {
    return axeScore("parallele", 0, "Pas de données de parallélisme.", "low");
  }

  const median = (par["median_concurrent_branches"] as number) ?? 0;
  const max = (par["max_concurrent_branches"] as number) ?? 0;

  if (median >= 3) {
    return axeScore("parallele", 4,
      `${median} branches concurrentes en médiane (max ${max}). Travail en parallèle soutenu.`,
      "high");
  }

  if (median >= 1) {
    // L'échelle donne rank 1, 2 et 3 = "1 branche" — pas de discrimination possible
    // On attribue rank 3 (le max pour median 1) car l'axe ne pénalise pas en dessous de 3 branches
    return axeScore("parallele", 3,
      `${median} branche concurrente en médiane (max ${max}). Travail séquentiel ou faiblement parallèle.`,
      "high");
  }

  return axeScore("parallele", 0,
    "Pas de travail en parallèle détecté.",
    "high");
}

// --- Helpers ---

function axeScore(axe: AxeId, rank: number, justification: string, confiance: Confiance): AxeScore {
  return { axe, rank, justification, confiance };
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
