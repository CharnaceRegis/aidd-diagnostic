import { createInterface } from "node:readline";
import type { Provider } from "./llm/index.js";
import type { Config } from "./config.js";
import { ecrireConfig } from "./config.js";

function question(rl: ReturnType<typeof createInterface>, q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

export async function setup(): Promise<Config> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n  Configuration initiale\n");
  console.log("  Quel provider LLM utiliser ?\n");
  console.log("    1. Claude (Anthropic)");
  console.log("    2. OpenAI (GPT)\n");

  let provider: Provider;
  while (true) {
    const choix = (await question(rl, "  Choix (1 ou 2) : ")).trim();
    if (choix === "1") { provider = "claude"; break; }
    if (choix === "2") { provider = "openai"; break; }
    console.log("  Tape 1 ou 2.");
  }

  const label = provider === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const apiKey = (await question(rl, `\n  ${label} : `)).trim();

  if (!apiKey) {
    rl.close();
    throw new Error("Clé API vide, abandon.");
  }

  rl.close();

  const config: Config = { provider, apiKey };
  ecrireConfig(config);

  console.log(`\n  Config sauvegardée dans .env (${provider})\n`);
  return config;
}
