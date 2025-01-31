import LayoutSplash from "@peated/web/components/layoutSplash";
import PasswordResetChangeForm from "@peated/web/components/passwordResetChangeForm";
import PasswordResetForm from "@peated/web/components/passwordResetForm";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Password Reset",
};

export default async function PasswordReset(props: {
  searchParams: Promise<Record<string, any>>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;

  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Password Reset</h1>
        <p className="text-muted text-center">
          {token
            ? "Enter a new password for your account to continue."
            : "Lose your password? Let's get started in fixing that."}
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
