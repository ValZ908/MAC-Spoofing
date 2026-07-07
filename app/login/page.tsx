import { SignIn } from "@/components/ui/signin-page";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return <SignIn action={signIn} error={error} />;
}
