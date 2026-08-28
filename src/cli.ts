#!/usr/bin/env node

import { createInterface, type Interface } from "node:readline";
import { existsSync } from "node:fs";
import { chargerGrille } from "./grille.js";
import { chargerProfils } from "./parser.js";
import { scorerProfil } from "./scorer.js";
import { scorerProfilHeuristique } from "./heuristic-scorer.js";
import { evaluer } from "./engine.js";
import { expliquer } from "./explainer.js";
import { expliquerHeuristique } from "./heuristic-explainer.js";
import { lireConfig } from "./config.js";
import { setup } from "./setup.js";
import { createClient, type LLMClient } from "./llm/index.js";
import type { Config } from "./config.js";
import type { AxeId, AxeScore, Diagnostic, Profil } from "./types.js";

type Mode = "heuristique" | "llm";

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

function afficherMenuHeuristique(): void {
  console.log("  Mode : heuristique (sans LLM)\n");
  console.log("  1. Évaluer un profil ou un dossier");
  console.log("  2. Configurer un LLM (mode enrichi)");
  console.log("  3. Quitter\n");
}

function afficherMenuLLM(provider: string): void {
  console.log(`  Mode : LLM (${provider})\n`);
  console.log("  1. Évaluer un profil ou un dossier");
  console.log("  2. Reconfigurer le LLM");
  console.log("  3. Repasser en mode heuristique");
  console.log("  4. Quitter\n");
}

async function diagnostiquerHeuristique(profil: Profil): Promise<Diagnostic> {
  const grille = chargerGrille();
  const scores = scorerProfilHeuristique(grille, profil);
  const { niveauGlobal, axeLimitant, confianceGlobale } = evaluer(grille, scores);
  const { explication, progression } = expliquerHeuristique(
    grille, scores, niveauGlobal, axeLimitant as AxeId
  );
  return { scores, niveauGlobal, axeLimitant, explication, progression, confianceGlobale };
}

async function diagnostiquerLLM(client: LLMClient, profil: Profil): Promise<Diagnostic> {
  const grille = chargerGrille();
  const scores = await scorerProfil(client, grille, profil);
  const { niveauGlobal, axeLimitant, confianceGlobale } = evaluer(grille, scores);
  const { explication, progression } = await expliquer(
    client, grille, scores, niveauGlobal, axeLimitant
  );
  return { scores, niveauGlobal, axeLimitant, explication, progression, confianceGlobale };
}

function afficherDiagnostic(profil: Profil, diag: Diagnostic): void {
  const sep = "─".repeat(50);

  console.log(`\n${sep}`);
  console.log(`  Profil : ${profil.id}`);
  console.log(sep);
  console.log(`\n  Niveau AIDD : ${diag.niveauGlobal.label}`);
  console.log(`  Axe limitant : ${diag.axeLimitant}`);
  console.log(`  Confiance globale : ${diag.confianceGlobale}`);

  console.log(`\n  Scores par axe :`);
  for (const s of diag.scores) {
    console.log(`    ${s.axe.padEnd(14)} → rank ${s.rank} [${s.confiance}]`);
    console.log(`      ${s.justification}`);
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

async function lancerEvaluation(
  rl: Interface,
  mode: Mode,
  client: LLMClient | null
): Promise<void> {
  const defaut = existsSync("profiles") ? "profiles/" : "";
  const invite = defaut
    ? `\n  Chemin du profil ou dossier [${defaut}] : `
    : "\n  Chemin du profil ou dossier : ";
  const saisie = (await ask(rl, invite)).trim();
  const chemin = saisie || defaut;
  if (!chemin) return;

  let profils: Profil[];
  try {
    profils = chargerProfils(chemin);
  } catch (err) {
    console.error(`\n  Erreur : ${err instanceof Error ? err.message : err}\n`);
    return;
  }

  console.log(`\n  ${profils.length} profil(s) chargé(s). Analyse en cours (${mode})...\n`);

  for (const profil of profils) {
    try {
      const diagnostic = mode === "llm" && client
        ? await diagnostiquerLLM(client, profil)
        : await diagnostiquerHeuristique(profil);
      afficherDiagnostic(profil, diagnostic);
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

  let mode: Mode = "heuristique";
  let config: Config | null = lireConfig();
  let client: LLMClient | null = null;

  if (config) {
    mode = "llm";
    client = createClient(config.provider, config.apiKey);
  }

  while (true) {
    if (mode === "llm" && config) {
      afficherMenuLLM(config.provider);
    } else {
      afficherMenuHeuristique();
    }

    const choix = (await ask(rl, "  Choix : ")).trim();

    if (mode === "heuristique") {
      switch (choix) {
        case "1":
          await lancerEvaluation(rl, mode, null);
          break;
        case "2": {
          const nouveau = await lancerSetup(rl);
          if (nouveau) {
            config = nouveau;
            client = createClient(config.provider, config.apiKey);
            mode = "llm";
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
    } else {
      switch (choix) {
        case "1":
          await lancerEvaluation(rl, mode, client);
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
          mode = "heuristique";
          client = null;
          config = null;
          console.log("\n  Repassé en mode heuristique.\n");
          break;
        case "4":
          console.log("\n  À bientôt.\n");
          rl.close();
          return;
        default:
          console.log("  Choix invalide.\n");
      }
    }
  }
}

main().catch((err) => {
  console.error("Erreur fatale :", err instanceof Error ? err.message : err);
  process.exit(1);
});
