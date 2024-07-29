"use client";

import Button from "@peated/web/components/button";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import { authenticate, authenticateForm } from "@peated/web/lib/auth.actions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";

function BasicLogin() {
  const { pending } = useFormStatus();

  const searchParams = useSearchParams();

  return (
    <>
      <div className="-mx-4 -mt-4">
        <input
          type="hidden"
          name="redirectTo"
          value={searchParams.get("redirectTo") ?? "/"}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          color="dark"
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="************"
          color="dark"
        />
      </div>
      <div className="flex justify-center gap-x-2">
        <Button type="submit" color="highlight" fullWidth loading={pending}>
          Sign in
        </Button>
      </div>
    </>
  );
}

export default function LoginForm() {
  const [error, formAction] = useFormState(authenticateForm, undefined);

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {error ? <Alert>{error}</Alert> : null}

      {config.GOOGLE_CLIENT_ID && (
        <>
          <GoogleLoginButton action={authenticate} />
          <div className="relative my-4 font-bold text-slate-500 opacity-60">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="min-w-full border-t-2 border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-900 px-2 text-lg uppercase">Or</span>
            </div>
          </div>
        </>
      )}

      <form action={formAction}>
        <BasicLogin />
      </form>

      <p className="mt-4 text-center text-sm">
        Don't have an account yet?{" "}
        <Link href="/register" className="text-highlight underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
