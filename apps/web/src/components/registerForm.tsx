"use client";

import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import TextField from "@peated/web/components/textField";
import { authenticate, registerForm } from "@peated/web/lib/auth.actions";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import config from "../config";
import Alert from "./alert";
import GoogleLoginButton from "./googleLoginButton";

function FormComponent() {
  const { pending } = useFormStatus();
  const [checked, setChecked] = useState(false);

  return (
    <>
      <div className="-mx-4 -mt-4">
        <TextField
          className="py-3"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          autoFocus
          disabled={pending}
        />
        <TextField
          className="py-3"
          name="username"
          label="Username"
          autoComplete="username"
          required
          placeholder="you99"
          disabled={pending}
        />
        <TextField
          className="py-3"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          min={8}
          placeholder="************"
          disabled={pending}
        />
        <label className="relative mb-3 block flex items-start gap-2 px-4 py-3 text-sm">
          <input
            type="checkbox"
            name="tosAccepted"
            required
            onChange={(e) => setChecked(e.target.checked)}
            disabled={pending}
          />
          <span>
            I agree to the{" "}
            <Link
              href="https://peated.com/terms"
              className="text-highlight underline"
            >
              Terms of Service
            </Link>
            .
          </span>
        </label>
      </div>
      <div className="flex justify-center gap-x-2">
        <Button
          type="submit"
          color="highlight"
          fullWidth
          loading={pending}
          disabled={!checked || pending}
          aria-busy={pending}
        >
          {pending ? "Signing up..." : "Sign Up"}
        </Button>
      </div>
    </>
  );
}

export default function RegisterForm() {
  const [result, formAction] = useFormState(registerForm, undefined);

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {result?.error ? <Alert>{result.error}</Alert> : null}

      {config.GOOGLE_CLIENT_ID && (
        <>
          <GoogleLoginButton
            action={authenticate}
            title="Sign up with Google"
          />
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
        <FormComponent />
      </form>

      <p className="mt-4 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-highlight underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}
