import { redirect } from "next/navigation";

export default async function PasswordResetRedirect(props: {
  searchParams: Promise<Record<string, any>>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;
  const url = token ? `/recover-account?token=${token}` : "/recover-account";
  redirect(url);
}
