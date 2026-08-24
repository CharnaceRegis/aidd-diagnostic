import Anthropic from "@anthropic-ai/sdk";
import type { AxeScore, Grille, NiveauDefinition } from "./types.js";
import { niveauParRank } from "./grille.js";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

export interface ExplicationResult {
  explication: string;
  progression: string;
}

export async function expliquer(
  grille: Grille,
  scores: AxeScore[],
  niveauGlobal: NiveauDefinition,
  axeLimitant: string
): Promise<ExplicationResult> {
  const client = getClient();

  const scoresResume = scores
    .map((s) => {
      const niv = niveauParRank(grille, s.rank);
      return `- **${s.axe}** : rank ${s.rank} (${niv.label}) — ${s.justification} [confiance: ${s.confiance}]`;
    })
    .join("\n");

  const niveauSuivant =
    niveauGlobal.rank < 6
      ? niveauParRank(grille, niveauGlobal.rank + 1)
      : null;

  const prompt = `Tu es un coach AIDD (AI-Driven Development).

## Diagnostic

Niveau global : **${niveauGlobal.label}** (rank ${niveauGlobal.rank})
Axe limitant : **${axeLimitant}**

Scores par axe :
${scoresResume}

${niveauSuivant ? `Niveau suivant à atteindre : **${niveauSuivant.label}** (rank ${niveauSuivant.rank})` : "Ce développeur est au niveau maximum."}

## Ta mission

1. **Explication** (5-8 lignes) : explique de façon claire et bienveillante pourquoi ce développeur est au niveau ${niveauGlobal.label}. Mentionne les axes forts et l'axe qui le retient. Sois factuel.

2. **Plan de progression** (5-8 lignes) : ${niveauSuivant ? `donne des actions concrètes pour atteindre le niveau ${niveauSuivant.label}. Concentre-toi sur l'axe limitant (${axeLimitant}) mais mentionne aussi les quick wins sur les autres axes si pertinent.` : "félicite le développeur et suggère comment consolider son niveau Gold."}

Réponds en JSON avec deux clés : "explication" et "progression". Pas de markdown dans les valeurs, juste du texte brut avec des retours à la ligne.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Pas de JSON dans la réponse");
    const parsed = JSON.parse(jsonMatch[0]) as ExplicationResult;
    return parsed;
  } catch {
    return {
      explication: `Niveau ${niveauGlobal.label} attribué. L'axe limitant est ${axeLimitant}.`,
      progression: niveauSuivant
        ? `Pour atteindre ${niveauSuivant.label}, concentre-toi sur l'axe ${axeLimitant}.`
        : "Niveau maximum atteint.",
    };
  }
}
