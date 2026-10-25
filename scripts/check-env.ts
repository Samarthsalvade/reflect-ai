import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "GROQ_API_KEY"];
let invalid = false;
for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("your_")) {
    console.error(`Missing or placeholder value: ${name}`);
    invalid = true;
  }
}
try {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error();
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL must be an HTTP(S) URL.");
  invalid = true;
}
if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_secret_")) {
  console.error("Use a publishable/anon Supabase key, never a secret key in NEXT_PUBLIC_ variables.");
  invalid = true;
}
if (invalid) process.exitCode = 1;
else console.log("Required environment settings are present. Values were not printed. Database migrations and provider access must also be verified.");
