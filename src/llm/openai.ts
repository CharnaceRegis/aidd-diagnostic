import OpenAI from "openai";
import type { LLMClient, LLMResponse, ToolSchema } from "./client.js";

export function createOpenAIClient(apiKey: string): LLMClient {
  const client = new OpenAI({ apiKey });

  return {
    async complete(prompt, options) {
      const tools = options?.tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: "object" as const,
            properties: t.properties,
            required: t.required,
          },
        },
      }));

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: options?.maxTokens ?? 1024,
        messages: [{ role: "user", content: prompt }],
        ...(tools && { tools }),
        ...(options?.forceToolName && {
          tool_choice: {
            type: "function" as const,
            function: { name: options.forceToolName },
          },
        }),
      });

      const message = response.choices[0]?.message;
      const toolCall = message?.tool_calls?.[0];

      let toolInput: Record<string, unknown> | null = null;
      if (toolCall && toolCall.type === "function") {
        try {
          toolInput = JSON.parse(toolCall.function.arguments);
        } catch {
          toolInput = null;
        }
      }

      return {
        toolInput,
        text: message?.content ?? null,
      };
    },
  };
}
