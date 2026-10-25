type AuthError = { name?: string; status?: number; code?: string; message: string };

// A transport failure is different from invalid credentials. Never include
// request headers, keys, or the raw underlying exception in a user-facing error.
export function authErrorMessage(error: AuthError, mode: "login" | "signup"): string {
  if (error.name === "AuthRetryableFetchError" && !error.status ||
      /fetch failed|failed to fetch|network request failed/i.test(error.message)) {
    return "Cannot reach the sign-in service. Check your internet connection or try another network, then retry.";
  }
  if (error.status === 429) return "Too many attempts. Please wait a few minutes before trying again.";
  if (error.status && error.status >= 500) return "The sign-in service is temporarily unavailable. Please try again later.";
  if (error.code === "email_not_confirmed") return "Confirm your email using the link in your inbox before signing in.";
  return mode === "login" ? "Incorrect email or password." : error.message;
}
