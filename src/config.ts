import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Provider } from "./llm/index.js";

const ENV_PATH = resolve(import.meta.dirname, "..", ".env");

export interface Config {
  provider: Provider;
  apiKey: string;
}

export function lireConfig(): Config | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "claude", apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: "openai", apiKey: process.env.OPENAI_API_KEY };
  }

  if (!existsSync(ENV_PATH)) return null;

  const lignes = readFileSync(ENV_PATH, "utf-8").split("\n");
  const vars: Record<string, string> = {};
  for (const ligne of lignes) {
    const match = ligne.match(/^([A-Z_]+)=(.+)$/);
    if (match) vars[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }

  if (vars["LLM_PROVIDER"] && vars["LLM_API_KEY"]) {
    return {
      provider: vars["LLM_PROVIDER"] as Provider,
      apiKey: vars["LLM_API_KEY"],
    };
  }

  return null;
}

export function ecrireConfig(config: Config): void {
  const contenu = `LLM_PROVIDER=${config.provider}\nLLM_API_KEY=${config.apiKey}\n`;
  writeFileSync(ENV_PATH, contenu, "utf-8");
}
