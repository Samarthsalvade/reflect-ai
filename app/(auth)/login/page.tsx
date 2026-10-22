import { AuthForm } from "@/components/auth/AuthForm";
import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const notice = error === "confirm" ? "That confirmation link is invalid or has expired." : undefined;
  return <AuthForm mode="login" action={login} next={next} notice={notice} />;
}
