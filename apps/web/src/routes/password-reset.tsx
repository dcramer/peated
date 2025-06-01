import LayoutSplash from "@peated/web/components/layoutSplash";
import PasswordResetChangeForm from "@peated/web/components/passwordResetChangeForm";
import PasswordResetForm from "@peated/web/components/passwordResetForm";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/password-reset")({
  component: PasswordReset,
  validateSearch: searchSchema,
});

function PasswordReset() {
  const { token } = Route.useSearch();

  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 font-semibold text-2xl">Password Reset</h1>
        <p className="text-center text-muted">
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
