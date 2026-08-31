#!/usr/bin/env node

import { createInterface, type Interface } from "node:readline";
import { existsSync, writeFileSync } from "node:fs";
import { chargerGrille } from "./grille.js";
import { chargerProfils } from "./parser.js";
import { scorerProfil } from "./scorer.js";
import { scorerProfilHeuristique } from "./heuristic-scorer.js";
import { evaluer, LABELS_AXES } from "./engine.js";
import { expliquer } from "./explainer.js";
import { expliquerHeuristique } from "./heuristic-explainer.js";
import { lireConfig } from "./config.js";
import { setup } from "./setup.js";
import { createClient, type LLMClient } from "./llm/index.js";
import { autoCheck } from "./check.js";
import type { Config } from "./config.js";
import type { AxeId, AxeScore, Diagnostic, Grille, Profil } from "./types.js";

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

function afficherMenuHeuristique(hasConfig: boolean): void {
  console.log("  Mode : heuristique (sans LLM)\n");
  console.log("  1. Évaluer un profil ou un dossier");
  console.log(hasConfig
    ? "  2. Repasser en mode LLM"
    : "  2. Configurer un LLM (mode enrichi)");
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
  const { niveauGlobal, axeLimitant, confianceGlobale, warnings } = evaluer(grille, scores);
  const { explication, progression } = expliquerHeuristique(
    grille, scores, niveauGlobal, axeLimitant as AxeId
  );
  return { scores, niveauGlobal, axeLimitant, explication, progression, confianceGlobale, warnings };
}

async function diagnostiquerLLM(client: LLMClient, profil: Profil): Promise<Diagnostic> {
  const grille = chargerGrille();
  const scores = await scorerProfil(client, grille, profil);
  const { niveauGlobal, axeLimitant, confianceGlobale, warnings } = evaluer(grille, scores);
  const { explication, progression } = await expliquer(
    client, grille, scores, niveauGlobal, axeLimitant
  );
  return { scores, niveauGlobal, axeLimitant, explication, progression, confianceGlobale, warnings };
}



function afficherEchelle(grille: Grille, rankActuel: number): string {
  return grille.niveaux
    .map((n) => {
      const emoji = n.label.split(" ")[0];
      return n.rank === rankActuel ? `[${emoji}]` : ` ${emoji} `;
    })
    .join("──");
}

function formaterDiagnostic(profil: Profil, diag: Diagnostic): string {
  const sep = "─".repeat(50);
  const grille = chargerGrille();
  const lignes: string[] = [];

  lignes.push(`\n${sep}`);
  lignes.push(`  ${profil.id}`);
  lignes.push(`  ${afficherEchelle(grille, diag.niveauGlobal.rank)}`);
  lignes.push(sep);

  for (const s of diag.scores) {
    const label = (LABELS_AXES[s.axe] ?? s.axe).padEnd(14);
    const limitant = s.axe === diag.axeLimitant ? " ◄ limitant" : "";
    const lowConf = s.confiance === "low" ? "  ⚠ données insuffisantes" : "";
    lignes.push(`  ${label} rank ${s.rank}${limitant}${lowConf}`);
    lignes.push(`    ${s.justification}\n`);
  }

  if (diag.warnings.length > 0) {
    lignes.push("");
    for (const w of diag.warnings) {
      lignes.push(`  ⚠ ${w}`);
    }
  }

  lignes.push(`\n  Progression :`);
  lignes.push(
    diag.progression
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n")
  );

  lignes.push(`\n${sep}\n`);
  return lignes.join("\n");
}

function formaterDiagnosticMd(profil: Profil, diag: Diagnostic): string {
  const grille = chargerGrille();
  const lignes: string[] = [];

  lignes.push(`## ${profil.id}`);
  lignes.push("");
  lignes.push(`**Niveau : ${diag.niveauGlobal.label}** (rank ${diag.niveauGlobal.rank})`);
  lignes.push("");
  lignes.push(`${afficherEchelle(grille, diag.niveauGlobal.rank)}`);
  lignes.push("");
  lignes.push("| Axe | Rank | |");
  lignes.push("|---|---|---|");

  for (const s of diag.scores) {
    const label = LABELS_AXES[s.axe] ?? s.axe;
    const limitant = s.axe === diag.axeLimitant ? "◄ limitant" : "";
    const lowConf = s.confiance === "low" ? "⚠ données insuffisantes" : "";
    lignes.push(`| ${label} | ${s.rank} | ${limitant} ${lowConf} |`);
  }

  lignes.push("");
  for (const s of diag.scores) {
    const label = LABELS_AXES[s.axe] ?? s.axe;
    lignes.push(`**${label}** : ${s.justification}`);
    lignes.push("");
  }

  if (diag.warnings.length > 0) {
    for (const w of diag.warnings) {
      lignes.push(`> ⚠ ${w}`);
      lignes.push("");
    }
  }

  lignes.push("### Progression");
  lignes.push("");
  lignes.push(diag.progression);
  lignes.push("");

  return lignes.join("\n");
}

function afficherDiagnostic(profil: Profil, diag: Diagnostic): void {
  console.log(formaterDiagnostic(profil, diag));
}

async function lancerEvaluation(
  rl: Interface,
  mode: Mode,
  client: LLMClient | null
): Promise<void> {
  const defaut = existsSync("profiles") ? "profiles/" : "";
  const invite = defaut
    ? `\n  Chemin (ex: profiles/, profiles/lancelot) [${defaut}] (q = retour) : `
    : "\n  Chemin du profil ou dossier (vide = retour) : ";
  const saisie = (await ask(rl, invite)).trim();
  if (saisie.toLowerCase() === "q") return;
  const chemin = saisie || defaut;
  if (!chemin) return;

  let profils: Profil[];
  try {
    profils = chargerProfils(chemin);
  } catch (err) {
    console.error(`\n  Erreur : ${err instanceof Error ? err.message : err}\n`);
    return;
  }

  console.clear();
  console.log(`\n  ${profils.length} profil(s) chargé(s). Analyse en cours (${mode})...\n`);

  const resultats: { profil: Profil; diagnostic: Diagnostic }[] = [];

  for (const profil of profils) {
    try {
      const diagnostic = mode === "llm" && client
        ? await diagnostiquerLLM(client, profil)
        : await diagnostiquerHeuristique(profil);
      afficherDiagnostic(profil, diagnostic);
      resultats.push({ profil, diagnostic });
    } catch (err) {
      console.error(
        `  Erreur sur le profil ${profil.id} :`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (resultats.length > 0) {
    const choixExport = (await ask(rl, "  Sauvegarder ? (t = .txt, m = .md, Entrée = non) : ")).trim().toLowerCase();
    if (choixExport === "t" || choixExport === "m") {
      const ext = choixExport === "t" ? "txt" : "md";
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

      for (const { profil, diagnostic } of resultats) {
        const fichier = `diagnostic-${profil.id}-${mode}-${ts}.${ext}`;
        const contenu = ext === "md"
          ? `# Diagnostic AIDD — ${profil.id}\n\nDate : ${now.toLocaleDateString("fr-FR")} | Mode : ${mode}\n\n${formaterDiagnosticMd(profil, diagnostic)}`
          : formaterDiagnostic(profil, diagnostic);
        writeFileSync(fichier, contenu, "utf-8");
        console.log(`  ✓ ${fichier}`);
      }
      console.log("");
    }
  }

  await ask(rl, "  Appuyer sur Entrée pour revenir au menu...");
}

async function lancerSetup(rl: Interface): Promise<Config | null> {
  return setup(rl);
}

async function main(): Promise<void> {
  if (process.argv.includes("--check")) {
    const idx = process.argv.indexOf("--check");
    const chemin = process.argv[idx + 1] || "profiles/";
    await autoCheck(chemin);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let mode: Mode = "heuristique";
  let config: Config | null = lireConfig();
  let client: LLMClient | null = null;

  while (true) {
    console.clear();
    afficherBanniere();

    if (mode === "llm" && config) {
      afficherMenuLLM(config.provider);
    } else {
      afficherMenuHeuristique(config !== null);
    }

    const choix = (await ask(rl, "  Choix : ")).trim();

    if (mode === "heuristique") {
      switch (choix) {
        case "1":
          await lancerEvaluation(rl, mode, null);
          break;
        case "2": {
          if (config) {
            client = client ?? createClient(config.provider, config.apiKey);
            mode = "llm";
          } else {
            const nouveau = await lancerSetup(rl);
            if (nouveau) {
              config = nouveau;
              client = createClient(config.provider, config.apiKey);
              mode = "llm";
            }
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
