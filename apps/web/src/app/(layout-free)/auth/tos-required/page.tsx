import { AuthenticationPanel } from "@peated/web/components/designSystem/patterns/authentication.stylex";
import { AuthenticationPage } from "@peated/web/components/designSystem/product/authenticationPage.stylex";
import { getSafeRedirect } from "@peated/web/lib/auth";
import { getSession } from "@peated/web/lib/session.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Actions from "./actions";

export const metadata: Metadata = {
  title: "Terms Required",
};

export default async function TOSRequired(props: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const searchParams = await props.searchParams;
  const redirectTo = getSafeRedirect(searchParams?.redirectTo ?? "/");
  const session = await getSession();

  if (!session.user) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  if (session.user.termsAcceptedAt) {
    redirect(redirectTo);
  }

  return (
    <AuthenticationPage intro="account">
      <AuthenticationPanel
        description="Review and accept the latest Terms of Service to continue."
        title="One thing before you continue"
      >
        <Actions redirectTo={redirectTo} />
      </AuthenticationPanel>
    </AuthenticationPage>
  );
}
