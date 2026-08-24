#!/usr/bin/env node

import { createInterface, type Interface } from "node:readline";
import { chargerGrille } from "./grille.js";
import { chargerProfils } from "./parser.js";
import { scorerProfil } from "./scorer.js";
import { evaluer } from "./engine.js";
import { expliquer } from "./explainer.js";
import { lireConfig } from "./config.js";
import { setup } from "./setup.js";
import { createClient, type LLMClient } from "./llm/index.js";
import type { Config } from "./config.js";
import type { Diagnostic, Profil } from "./types.js";

function ask(rl: Interface, q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

function afficherBanniere(): void {
  console.log(`
  ╔════════════════════════════════════════╗
  ║        aidd-diagnostic                 ║
  ║   Diagnostic AI-Driven Development     ║
  ╚════════════════════════════════════════╝
`);
}

function afficherMenu(provider: string): void {
  console.log(`  Provider actif : ${provider}\n`);
  console.log("  1. Évaluer un profil ou un dossier");
  console.log("  2. Configurer le provider LLM");
  console.log("  3. Quitter\n");
}

async function diagnostiquer(
  client: LLMClient,
  profil: Profil
): Promise<Diagnostic> {
  const grille = chargerGrille();

  const scores = await scorerProfil(client, grille, profil);
  const { niveauGlobal, axeLimitant, confianceGlobale } = evaluer(
    grille,
    scores
  );
  const { explication, progression } = await expliquer(
    client,
    grille,
    scores,
    niveauGlobal,
    axeLimitant
  );

  return {
    scores,
    niveauGlobal,
    axeLimitant,
    explication,
    progression,
    confianceGlobale,
  };
}

function afficherDiagnostic(profil: Profil, diag: Diagnostic, verbose: boolean): void {
  const sep = "─".repeat(50);

  console.log(`\n${sep}`);
  console.log(`  Profil : ${profil.nom ?? profil.id}`);
  console.log(sep);
  console.log(`\n  Niveau AIDD : ${diag.niveauGlobal.label}`);
  console.log(`  Axe limitant : ${diag.axeLimitant}`);
  if (verbose) {
    console.log(`  Confiance globale : ${diag.confianceGlobale}`);
  }

  console.log(`\n  Scores par axe :`);
  for (const s of diag.scores) {
    const conf = verbose ? ` [${s.confiance}]` : "";
    console.log(`    ${s.axe.padEnd(14)} → rank ${s.rank}${conf}`);
    if (verbose) {
      console.log(`      ${s.justification}`);
    }
  }

  console.log(`\n  Explication :`);
  console.log(
    diag.explication
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n")
  );

  console.log(`\n  Progression :`);
  console.log(
    diag.progression
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n")
  );

  console.log(`\n${sep}\n`);
}

async function lancerEvaluation(rl: Interface, client: LLMClient): Promise<void> {
  const chemin = (await ask(rl, "\n  Chemin du profil ou dossier : ")).trim();
  if (!chemin) return;

  const verbose = (await ask(rl, "  Mode verbose ? (o/N) : ")).trim().toLowerCase() === "o";

  let profils: Profil[];
  try {
    profils = chargerProfils(chemin);
  } catch (err) {
    console.error(`\n  Erreur : ${err instanceof Error ? err.message : err}\n`);
    return;
  }

  console.log(`\n  ${profils.length} profil(s) chargé(s). Analyse en cours...\n`);

  for (const profil of profils) {
    try {
      const diagnostic = await diagnostiquer(client, profil);
      afficherDiagnostic(profil, diagnostic, verbose);
    } catch (err) {
      console.error(
        `  Erreur sur le profil ${profil.id} :`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function lancerSetup(rl: Interface): Promise<Config | null> {
  try {
    return await setup(rl);
  } catch (err) {
    console.error(`\n  ${err instanceof Error ? err.message : err}\n`);
    return null;
  }
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  afficherBanniere();

  let config: Config | null = lireConfig();
  if (!config) {
    console.log("  Première utilisation — configuration requise.\n");
    config = await lancerSetup(rl);
    if (!config) {
      rl.close();
      return;
    }
  }

  let client = createClient(config.provider, config.apiKey);

  while (true) {
    afficherMenu(config.provider);
    const choix = (await ask(rl, "  Choix : ")).trim();

    switch (choix) {
      case "1":
        await lancerEvaluation(rl, client);
        break;

      case "2": {
        const nouveau = await lancerSetup(rl);
        if (nouveau) {
          config = nouveau;
          client = createClient(config.provider, config.apiKey);
        }
        break;
      }

      case "3":
        console.log("\n  À bientôt.\n");
        rl.close();
        return;

      default:
        console.log("  Choix invalide.\n");
    }
  }
}

main().catch((err) => {
  console.error("Erreur fatale :", err instanceof Error ? err.message : err);
  process.exit(1);
});
