import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

describe("authentication failure messages", () => {
  it("distinguishes a connection failure from invalid login credentials", () => {
    for (const mode of ["login", "signup"] as const) {
      expect(authErrorMessage({ name: "AuthRetryableFetchError", status: 0, message: "fetch failed" }, mode)).toContain("try another network");
    }
  });
  it("does not misclassify upstream server failures as connection failures", () => {
    expect(authErrorMessage({ name: "AuthRetryableFetchError", status: 503, message: "unavailable" }, "login")).toContain("temporarily unavailable");
  });
  it("keeps credential errors generic", () => {
    expect(authErrorMessage({ message: "internal details" }, "login")).toBe("Incorrect email or password.");
  });
  it("explains email confirmation and rate limits", () => {
    expect(authErrorMessage({ code: "email_not_confirmed", message: "unconfirmed" }, "login")).toContain("Confirm your email");
    expect(authErrorMessage({ status: 429, message: "limited" }, "signup")).toContain("wait a few minutes");
  });
});
