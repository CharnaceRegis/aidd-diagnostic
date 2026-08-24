import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient, LLMResponse, ToolSchema } from "./client.js";

export function createAnthropicClient(apiKey: string): LLMClient {
  const client = new Anthropic({ apiKey });

  return {
    async complete(prompt, options) {
      const tools = options?.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: {
          type: "object" as const,
          properties: t.properties,
          required: t.required,
        },
      }));

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: options?.maxTokens ?? 1024,
        messages: [{ role: "user", content: prompt }],
        ...(tools && { tools }),
        ...(options?.forceToolName && {
          tool_choice: { type: "tool" as const, name: options.forceToolName },
        }),
      });

      const toolBlock = response.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      const textBlock = response.content.find(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      );

      return {
        toolInput: toolBlock
          ? (toolBlock.input as Record<string, unknown>)
          : null,
        text: textBlock?.text ?? null,
      };
    },
  };
}
