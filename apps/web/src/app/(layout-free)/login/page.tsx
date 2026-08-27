import { ProductAuthShell } from "@peated/web/components/designSystem/product/authPageShell.stylex";
import LoginForm from "@peated/web/components/loginForm";
import { getSafeRedirect } from "@peated/web/lib/auth";
import { getSession } from "@peated/web/lib/session.server";
import { type Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
};

export default async function Login(props: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (session.user) {
    redirect(getSafeRedirect(searchParams?.redirectTo ?? "/"));
  }

  return (
    <ProductAuthShell intro="database">
      <LoginForm />
    </ProductAuthShell>
  );
}
