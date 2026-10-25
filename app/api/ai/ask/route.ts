export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { error, json, parseBody, requireUser } from "@/lib/api/http";
import { AskQuestion } from "@/lib/journal/schema";
import { askJournal } from "@/lib/ai/rag";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ai/ask — embed question → retrieve own chunks → grounded answer → citations.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, AskQuestion);
  if (body instanceof NextResponse) return body;

  const { data: allowed, error: quotaError } = await auth.supabase.rpc("consume_ai_quota", {
    p_limit: serverEnv.askLimitPerHour(),
  });
  if (quotaError) return error(500, "Could not check your AI usage");
  if (!allowed) return error(429, "You've reached the hourly question limit. Try again later.");

  try {
    const result = await askJournal(auth.supabase, body.question);
    return json(result);
  } catch (err) {
    console.error("[ask]", err instanceof Error ? err.message : err);
    return error(502, "The AI service is unavailable right now. Your journal is safe; please try again.");
  }
}
