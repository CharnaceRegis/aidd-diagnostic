#!/usr/bin/env node

import { parseArgs } from "node:util";
import { chargerGrille } from "./grille.js";
import { chargerProfils } from "./parser.js";
import { scorerProfil } from "./scorer.js";
import { evaluer } from "./engine.js";
import { expliquer } from "./explainer.js";
import { lireConfig } from "./config.js";
import { setup } from "./setup.js";
import { createClient, type LLMClient } from "./llm/index.js";
import type { Diagnostic, Profil } from "./types.js";

const { values } = parseArgs({
  options: {
    profil: { type: "string", short: "p" },
    json: { type: "boolean", default: false },
    verbose: { type: "boolean", short: "v", default: false },
    help: { type: "boolean", short: "h", default: false },
    setup: { type: "boolean", default: false },
  },
});

if (values.help || (!values.profil && !values.setup)) {
  console.log(`
aidd-eval — Diagnostic AI-Driven Development

Usage :
  aidd-eval --profil <fichier_ou_dossier> [options]

Options :
  -p, --profil   Chemin vers un profil (JSON/YAML) ou un dossier de profils
  -v, --verbose  Afficher les scores de confiance par axe
      --json     Sortie JSON au lieu de la sortie formatée
      --setup    Configurer le provider LLM et la clé API
  -h, --help     Afficher cette aide
`);
  process.exit(values.help ? 0 : 1);
}

async function getClient(): Promise<LLMClient> {
  let config = lireConfig();

  if (!config) {
    console.log("  Aucune configuration LLM détectée.\n");
    config = await setup();
  }

  return createClient(config.provider, config.apiKey);
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

function afficher(profil: Profil, diag: Diagnostic, verbose: boolean): void {
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

async function main(): Promise<void> {
  if (values.setup) {
    await setup();
    return;
  }

  const client = await getClient();
  const profils = chargerProfils(values.profil!);

  console.log(`\n${profils.length} profil(s) chargé(s). Analyse en cours...\n`);

  const resultats: Array<{ profil: Profil; diagnostic: Diagnostic }> = [];

  for (const profil of profils) {
    try {
      const diagnostic = await diagnostiquer(client, profil);
      resultats.push({ profil, diagnostic });

      if (!values.json) {
        afficher(profil, diagnostic, values.verbose ?? false);
      }
    } catch (err) {
      console.error(
        `Erreur sur le profil ${profil.id} :`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (values.json) {
    console.log(JSON.stringify(resultats, null, 2));
  }
}

main().catch((err) => {
  console.error("Erreur fatale :", err instanceof Error ? err.message : err);
  process.exit(1);
});
