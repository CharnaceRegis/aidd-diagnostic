import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LLMClient, ToolSchema } from "./llm/index.js";
import type { AxeDefinition, AxeId, AxeScore, Confiance, Grille, Profil } from "./types.js";

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
      description: "Explication courte (2-3 phrases) de pourquoi ce rank a été attribué.",
    },
    confiance: {
      type: "string",
      description: "Niveau de confiance. 'low' si les données sont insuffisantes.",
      enum: ["high", "medium", "low"],
    },
  },
  required: ["rank", "justification", "confiance"],
};

function construirePromptAxe(axe: AxeDefinition, profil: Profil): string {
  const promptPath = resolve(import.meta.dirname, "prompts", "score-axis.md");
  let template: string;
  try {
    template = readFileSync(promptPath, "utf-8");
  } catch {
    template = PROMPT_FALLBACK;
  }

  return template
    .replace("{{AXE_ID}}", axe.id)
    .replace("{{AXE_LABEL}}", axe.label)
    .replace("{{AXE_DESCRIPTION}}", axe.description)
    .replace(
      "{{AXE_ECHELLE}}",
      axe.echelle.map((e) => `  rank ${e.rank} → ${e.valeur}`).join("\n")
    )
    .replace("{{PROFIL}}", JSON.stringify(profil.donnees, null, 2));
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
