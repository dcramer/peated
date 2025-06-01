import LayoutSplash from "@peated/web/components/layoutSplash";
import PasswordResetChangeForm from "@peated/web/components/passwordResetChangeForm";
import PasswordResetForm from "@peated/web/components/passwordResetForm";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/password-reset")({
  component: PasswordReset,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || null,
  }),
});

function PasswordReset() {
  const { token } = Route.useSearch();

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
