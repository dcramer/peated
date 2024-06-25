"use client";

import Button from "@peated/web/components/button";
import Form from "@peated/web/components/form";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import { authenticate } from "@peated/web/lib/auth.actions";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";

function BasicLogin({ action }: { action: any }) {
  const { pending } = useFormStatus();

  return (
    <Form action={action}>
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="mb-2 rounded"
      />
      <TextField
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="password"
        className="mb-2 rounded"
      />
      <div className="flex justify-center">
        <Button type="submit" color="highlight" fullWidth loading={pending}>
          Sign in
        </Button>
      </div>
    </Form>
  );
}

export default function LoginForm() {
  const [error, formAction] = useFormState(authenticate, undefined);

  return (
    <div className="min-w-sm mt-8 flex-auto">
      {error ? <Alert>{error}</Alert> : null}
      {config.GOOGLE_CLIENT_ID && (
        <>
          <GoogleLoginButton action={formAction} />
          <div className="relative my-4 text-slate-700">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="min-w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-950 px-2 text-sm">Or</span>
            </div>
          </div>
        </>
      )}
      <BasicLogin action={formAction} />
    </div>
  );
}
