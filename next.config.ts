import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OpenAI SDK and Supabase run only on the server; keep them out of client bundles.
  serverExternalPackages: ["openai"],
};

export default nextConfig;
