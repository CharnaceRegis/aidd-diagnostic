import { createInterface, type Interface } from "node:readline";
import type { Provider } from "./llm/index.js";
import type { Config } from "./config.js";
import { ecrireConfig } from "./config.js";

function question(rl: Interface, q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

export async function setup(rlExterne?: Interface): Promise<Config | null> {
  const rl = rlExterne ?? createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n  Configuration du provider LLM\n");
  console.log("    1. Claude (Anthropic)");
  console.log("    2. OpenAI (GPT)");
  console.log("    q. Retour\n");

  let provider: Provider;
  while (true) {
    const choix = (await question(rl, "  Choix : ")).trim().toLowerCase();
    if (choix === "q" || choix === "") {
      if (!rlExterne) rl.close();
      return null;
    }
    if (choix === "1") { provider = "claude"; break; }
    if (choix === "2") { provider = "openai"; break; }
    console.log("  Tape 1, 2 ou q.");
  }

  const label = provider === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const apiKey = (await question(rl, `\n  ${label} (vide = retour) : `)).trim();

  if (!apiKey) {
    if (!rlExterne) rl.close();
    console.log("\n  Annulé.\n");
    return null;
  }

  if (!rlExterne) rl.close();

  const config: Config = { provider, apiKey };
  ecrireConfig(config);

  console.log(`\n  Config sauvegardée dans .env (${provider})\n`);
  return config;
}
