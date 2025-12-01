import { redirect } from "next/navigation";

export default function PasswordResetRedirect({
  searchParams,
}: {
  searchParams: Record<string, any>;
}) {
  const token = searchParams.token;
  const url = token ? `/recover-account?token=${token}` : "/recover-account";
  redirect(url);
}
