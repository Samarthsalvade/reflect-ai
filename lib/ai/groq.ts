import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { providerJson } from "./provider-http";

export async function chatCompletion(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const response = await providerJson("Groq", "https://api.groq.com/openai/v1/chat/completions", serverEnv.groqKey(), {
    model: serverEnv.chatModel(),
    temperature: 0.2,
    max_completion_tokens: 1024,
    response_format: { type: "json_object" },
    messages,
  });
  const parsed = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) }).safeParse(response);
  if (!parsed.success) throw new Error("Groq returned an unreadable response");
  return parsed.data.choices[0].message.content;
}
