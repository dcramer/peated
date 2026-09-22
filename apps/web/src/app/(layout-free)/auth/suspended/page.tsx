import { AuthenticationPage } from "@peated/web/components/auth/authenticationPage.stylex";
import { AuthenticationPanel } from "@peated/web/components/pages/authentication.stylex";
import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import { getSession } from "@peated/web/lib/session.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Actions from "./actions";

export const metadata: Metadata = {
  title: "Account suspended",
  ...noIndexPageMetadata,
};

export default async function SuspendedPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login");
  }
  if (!session.user.suspendedAt) {
    redirect("/");
  }

  return (
    <AuthenticationPage intro="suspended">
      <AuthenticationPanel
        description="A moderator suspended your account. Until it is reinstated you can only delete your account, or keep it if a deletion is pending."
        title="Your account is suspended"
      >
        <Actions />
      </AuthenticationPanel>
    </AuthenticationPage>
  );
}
