import { AuthenticationPage } from "@peated/web/components/auth/authenticationPage.stylex";
import PasswordResetChangeForm from "@peated/web/components/passwordResetChangeForm";
import PasswordResetForm from "@peated/web/components/passwordResetForm";
import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Recovery",
  ...noIndexPageMetadata,
};

export default async function PasswordReset(props: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;
  const email = searchParams.email ?? "";

  return (
    <AuthenticationPage intro="database">
      {token ? (
        <PasswordResetChangeForm token={token} />
      ) : (
        <PasswordResetForm initialEmail={email} />
      )}
    </AuthenticationPage>
  );
}
