import type { LLMClient, Provider } from "./client.js";
import { createAnthropicClient } from "./anthropic.js";
import { createOpenAIClient } from "./openai.js";

export type { LLMClient, Provider, ToolSchema, LLMResponse } from "./client.js";

export function createClient(provider: Provider, apiKey: string): LLMClient {
  switch (provider) {
    case "claude":
      return createAnthropicClient(apiKey);
    case "openai":
      return createOpenAIClient(apiKey);
  }
}
