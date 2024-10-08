"use client";

import Button from "@peated/web/components/button";
import TextField from "@peated/web/components/textField";
import { passwordResetConfirmForm } from "@peated/web/lib/auth.actions";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";

function FormComponent({ token }: { token: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      <div className="-mx-4 -mt-4">
        <input type="hidden" name="token" value={token} />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="password"
          required
          placeholder="************"
          autoFocus
        />
      </div>
      <div className="flex justify-center gap-x-2">
        <Button type="submit" color="highlight" fullWidth loading={pending}>
          Continue
        </Button>
      </div>
    </>
  );
}

export default function PasswordResetChangeForm({ token }: { token: string }) {
  const [result, formAction] = useFormState(
    passwordResetConfirmForm,
    undefined,
  );

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.ok ? (
        <>
          <p className="mb-8 text-center">Your password has been changed.</p>
          <Button href="/" color="highlight">
            Return to Peated
          </Button>
        </>
      ) : (
        <form action={formAction}>
          <FormComponent token={token} />
        </form>
      )}
    </div>
  );
}
