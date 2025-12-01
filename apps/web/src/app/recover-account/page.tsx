import LayoutSplash from "@peated/web/components/layoutSplash";
import PasswordResetChangeForm from "@peated/web/components/passwordResetChangeForm";
import PasswordResetForm from "@peated/web/components/passwordResetForm";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Recovery",
};

export default function PasswordReset({
  searchParams,
}: {
  searchParams: Record<string, any>;
}) {
  const token = searchParams.token;

  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Account Recovery</h1>
        <p className="text-muted text-center">
          {token
            ? "Enter a new password for your account to continue."
            : "Lost access to your account? Let's get you back in."}
        </p>
      </div>
      {token ? (
        <PasswordResetChangeForm token={token} />
      ) : (
        <PasswordResetForm />
      )}
    </LayoutSplash>
  );
}
