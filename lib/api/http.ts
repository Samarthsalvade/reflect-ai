import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";

export function json<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

export function error(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

type Authed = { supabase: SupabaseClient; user: User };

// Every API route starts here. The user comes from the verified session cookie —
// never from the request body — and the returned client runs under RLS as that user.
export async function requireUser(): Promise<Authed | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error(401, "Not signed in");
  return { supabase, user };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  // JSON only: blocks cross-site "simple" form posts riding on the session cookie.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return error(415, "Expected application/json");
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error(400, "Invalid JSON body");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return error(
      400,
      "Validation failed",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}
