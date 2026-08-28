import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LLMClient, ToolSchema } from "./llm/index.js";
import type {
  AxeDefinition,
  AxeId,
  AxeScore,
  Confiance,
  Grille,
  Profil,
  ProfilPieces,
  RepoContextSummary,
} from "./types.js";

const SCORE_TOOL: ToolSchema = {
  name: "score_axe",
  description: "Retourne le score d'un axe AIDD pour un profil donné.",
  properties: {
    rank: {
      type: "number",
      description: "Le rank (0 à 6) correspondant au niveau sur cet axe.",
    },
    justification: {
      type: "string",
      description:
        "Explication courte (2-3 phrases) de pourquoi ce rank a été attribué, en citant les preuves concrètes.",
    },
    confiance: {
      type: "string",
      description: "Niveau de confiance. 'low' si les données sont insuffisantes.",
      enum: ["high", "medium", "low"],
    },
  },
  required: ["rank", "justification", "confiance"],
};

/** Sélectionne les pièces pertinentes pour un axe */
function selectionnerPieces(axe: AxeId, pieces: ProfilPieces): string {
  const sections: string[] = [];

  const ajouterJson = (titre: string, data: unknown) => {
    if (data) sections.push(`### ${titre}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
  };

  const ajouterTexte = (titre: string, texte: string | null) => {
    if (texte) sections.push(`### ${titre}\n${texte}`);
  };

  switch (axe) {
    case "taille":
      ajouterJson("Activité Git", extrairePourTaille(pieces));
      ajouterJson("Pull Requests", pieces.pullRequests);
      ajouterCode(sections, pieces);
      ajouterJson("Sonar", pieces.sonarMeasures);
      break;

    case "harness":
      ajouterRepoContext(sections, pieces.repoContext);
      ajouterJson("Context files & assistant usage",
        extrairePourHarness(pieces));
      ajouterTexte("Déclaratif (auto-évaluation, à confronter aux faits)",
        pieces.declaratif);
      break;

    case "intervention":
      ajouterTexte("Session de travail", pieces.session);
      ajouterTexte("Déclaratif (auto-évaluation, à confronter aux faits)",
        pieces.declaratif);
      ajouterJson("Indicateurs d'intervention",
        extrairePourIntervention(pieces));
      ajouterJson("Pull Requests", pieces.pullRequests);
      break;

    case "parallele":
      ajouterJson("Parallélisme", extrairePourParallele(pieces));
      ajouterTexte("Session de travail", pieces.session);
      break;
  }

  if (sections.length === 0) {
    return "*Aucune donnée disponible pour cet axe.*";
  }

  return sections.join("\n\n");
}

function extrairePourTaille(pieces: ProfilPieces): Record<string, unknown> | null {
  const ga = pieces.gitActivity;
  if (!ga) return null;
  const pr = ga["pull_requests"] as Record<string, unknown> | undefined;
  return {
    pull_requests: pr ? {
      total: pr["total"],
      size_distribution: pr["size_distribution"],
      median_files_changed: pr["median_files_changed"],
      median_lines_changed: pr["median_lines_changed"],
    } : null,
    commits: ga["commits"],
    tests: ga["tests"],
  };
}

function extrairePourHarness(pieces: ProfilPieces): Record<string, unknown> | null {
  const ga = pieces.gitActivity;
  if (!ga) return null;
  return {
    context_files: ga["context_files"],
    assistant_usage: ga["assistant_usage"],
  };
}

function extrairePourIntervention(pieces: ProfilPieces): Record<string, unknown> | null {
  const ga = pieces.gitActivity;
  if (!ga) return null;
  const pr = ga["pull_requests"] as Record<string, unknown> | undefined;
  return {
    pull_requests: pr ? {
      median_correction_commits_after_open: pr["median_correction_commits_after_open"],
      merged_without_human_edit_after_open: pr["merged_without_human_edit_after_open"],
      reverted: pr["reverted"],
      median_review_comments_received: pr["median_review_comments_received"],
    } : null,
    ci: ga["ci"],
    commits: ga["commits"],
  };
}

function extrairePourParallele(pieces: ProfilPieces): Record<string, unknown> | null {
  const ga = pieces.gitActivity;
  if (!ga) return null;
  return {
    parallelism: ga["parallelism"],
  };
}

function ajouterCode(sections: string[], pieces: ProfilPieces): void {
  if (pieces.code.length === 0) return;
  const bloc = pieces.code
    .map((f) => `#### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");
  sections.push(`### Échantillons de code\n${bloc}`);
}

function ajouterRepoContext(sections: string[], rc: RepoContextSummary | null): void {
  if (!rc) {
    sections.push("### Repo context\n*Aucun fichier de contexte IA détecté dans le dépôt.*");
    return;
  }

  if (rc.claudeMd) {
    sections.push(`### CLAUDE.md\n${rc.claudeMd}`);
  }
  if (rc.agentsMd) {
    sections.push(`### AGENTS.md\n${rc.agentsMd}`);
  }

  const inventaire: string[] = [];
  if (rc.agentFiles.length > 0) inventaire.push(`- Agents : ${rc.agentFiles.join(", ")}`);
  if (rc.skillFiles.length > 0) inventaire.push(`- Skills : ${rc.skillFiles.join(", ")}`);
  if (rc.ruleFiles.length > 0) inventaire.push(`- Rules : ${rc.ruleFiles.join(", ")}`);
  if (rc.hookFiles.length > 0) inventaire.push(`- Hooks : ${rc.hookFiles.join(", ")}`);
  if (rc.docsFiles.length > 0) inventaire.push(`- Docs : ${rc.docsFiles.join(", ")}`);
  if (rc.settingsJson) inventaire.push(`- Settings : ${JSON.stringify(rc.settingsJson)}`);

  if (inventaire.length > 0) {
    sections.push(`### Inventaire repo-context\n${inventaire.join("\n")}`);
  }
}

function construirePromptAxe(axe: AxeDefinition, profil: Profil): string {
  const promptPath = resolve(import.meta.dirname, "prompts", "score-axis.md");
  let template: string;
  try {
    template = readFileSync(promptPath, "utf-8");
  } catch {
    template = PROMPT_FALLBACK;
  }

  const contexteProfil = [
    `**Profil** : ${profil.meta.profile_id} — ${profil.meta.role}, ${profil.meta.experience_years} ans d'expérience`,
    `**Stack** : ${profil.meta.stack.join(", ")}`,
    `**Équipe** : ${profil.meta.team_size} personne(s)`,
    profil.meta.note ? `**Note** : ${profil.meta.note}` : null,
  ].filter(Boolean).join("\n");

  const piecesAxe = selectionnerPieces(axe.id as AxeId, profil.pieces);

  return template
    .replace("{{AXE_ID}}", axe.id)
    .replace("{{AXE_LABEL}}", axe.label)
    .replace("{{AXE_DESCRIPTION}}", axe.description)
    .replace(
      "{{AXE_ECHELLE}}",
      axe.echelle.map((e) => `  rank ${e.rank} → ${e.valeur}`).join("\n")
    )
    .replace("{{PROFIL}}", `${contexteProfil}\n\n## Pièces du dossier\n\n${piecesAxe}`);
}

export async function scorerProfil(
  client: LLMClient,
  grille: Grille,
  profil: Profil
): Promise<AxeScore[]> {
  return Promise.all(grille.axes.map((axe) => scorerAxe(client, axe, profil)));
}

async function scorerAxe(
  client: LLMClient,
  axe: AxeDefinition,
  profil: Profil
): Promise<AxeScore> {
  const prompt = construirePromptAxe(axe, profil);

  const response = await client.complete(prompt, {
    tools: [SCORE_TOOL],
    forceToolName: "score_axe",
    maxTokens: 512,
  });

  if (!response.toolInput) {
    return {
      axe: axe.id as AxeId,
      rank: 0,
      justification: "Impossible d'obtenir un score du LLM.",
      confiance: "low",
    };
  }

  const input = response.toolInput as {
    rank: number;
    justification: string;
    confiance: Confiance;
  };

  return {
    axe: axe.id as AxeId,
    rank: Math.max(0, Math.min(6, Math.round(input.rank))),
    justification: input.justification,
    confiance: input.confiance,
  };
}

const PROMPT_FALLBACK = `Tu es un évaluateur AIDD (AI-Driven Development).

Évalue le profil suivant sur l'axe **{{AXE_LABEL}}** ({{AXE_ID}}).

## Définition de l'axe

{{AXE_DESCRIPTION}}

## Échelle

{{AXE_ECHELLE}}

## Profil à évaluer

{{PROFIL}}

## Consignes

- Attribue un rank de 0 à 6 en te basant sur l'échelle ci-dessus.
- Si les données sont insuffisantes pour cet axe, retourne confiance: "low" et explique ce qui manque.
- Sois factuel : base-toi sur ce qui est décrit, pas sur des suppositions.
- Utilise l'outil score_axe pour retourner ta réponse.`;
