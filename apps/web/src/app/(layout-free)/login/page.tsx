import LayoutSplash from "@peated/web/components/layoutSplash";
import LoginForm from "@peated/web/components/loginForm";
import { getSafeRedirect } from "@peated/web/lib/auth";
import { getSession } from "@peated/web/lib/session.server";
import { type Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
};

export default async function Login({
  searchParams,
}: {
  searchParams: { redirectTo?: string };
}) {
  const session = await getSession();
  if (session.user) {
    redirect(getSafeRedirect(searchParams?.redirectTo ?? "/"));
  }

  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Welcome Back</h1>
        <p className="text-muted text-center">
          Continue with Google or enter your credentials.
        </p>
      </div>
      <LoginForm />
    </LayoutSplash>
  );
}
