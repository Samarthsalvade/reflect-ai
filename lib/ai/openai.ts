import "server-only";
import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: serverEnv.openaiKey(), timeout: 30_000, maxRetries: 2 });
  return client;
}
