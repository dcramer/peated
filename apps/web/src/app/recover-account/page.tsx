import { ProductAuthShell } from "@peated/web/components/designSystem/product/authPageShell.stylex";
import PasswordResetChangeForm from "@peated/web/components/passwordResetChangeForm";
import PasswordResetForm from "@peated/web/components/passwordResetForm";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Recovery",
};

export default async function PasswordReset(props: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;
  const email = searchParams.email ?? "";

  return (
    <ProductAuthShell intro="database">
      {token ? (
        <PasswordResetChangeForm token={token} />
      ) : (
        <PasswordResetForm initialEmail={email} />
      )}
    </ProductAuthShell>
  );
}
