export interface ToolProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  properties: Record<string, ToolProperty>;
  required: string[];
}

export interface LLMResponse {
  toolInput: Record<string, unknown> | null;
  text: string | null;
}

export interface LLMClient {
  complete(prompt: string, options?: { tools?: ToolSchema[]; forceToolName?: string; maxTokens?: number }): Promise<LLMResponse>;
}

export type Provider = "claude" | "openai";
