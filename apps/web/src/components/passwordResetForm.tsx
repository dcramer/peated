"use client";

import Button from "@peated/web/components/button";
import TextField from "@peated/web/components/textField";
import { passwordResetForm } from "@peated/web/lib/auth.actions";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";

function FormComponent() {
  const { pending } = useFormStatus();

  return (
    <>
      <div className="-mx-4 -mt-4">
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
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

export default function PasswordResetForm() {
  const [result, formAction] = useFormState(passwordResetForm, undefined);

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.ok ? (
        <p className="mb-8 text-center">
          We've sent instructions to your email address.
        </p>
      ) : (
        <form action={formAction}>
          <FormComponent />
        </form>
      )}
    </div>
  );
}
