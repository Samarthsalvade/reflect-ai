// Shared by server-only wrappers and the local seed script. Never import in client components.
export async function providerJson(provider: string, url: string, key: string, body: unknown): Promise<unknown> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
      redirect: "error",
    });
    // Do not log upstream bodies: they can contain private input or credentials.
    if (!response.ok) throw new Error(`${provider} request failed (HTTP ${response.status})`);
    return await response.json();
  } catch (error) {
    if (error instanceof Error && /^.+ request failed \(HTTP \d{3}\)$/.test(error.message)) throw error;
    throw new Error(`${provider} request failed or returned invalid JSON`);
  }
}
