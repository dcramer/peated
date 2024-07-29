"use client";

import Button from "@peated/web/components/button";
import TextField from "@peated/web/components/textField";
import { authenticate, registerForm } from "@peated/web/lib/auth.actions";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import config from "../config";
import Alert from "./alert";
import GoogleLoginButton from "./googleLoginButton";

function SignupForm() {
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
          color="dark"
        />
        <TextField
          name="username"
          label="Username"
          autoComplete="username"
          required
          placeholder="you99"
          color="dark"
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          min={8}
          placeholder="************"
          color="dark"
        />
      </div>
      <div className="flex justify-center gap-x-2">
        <Button type="submit" color="highlight" fullWidth loading={pending}>
          Sign Up
        </Button>
      </div>
    </>
  );
}

export default function RegisterForm() {
  const [error, formAction] = useFormState(registerForm, undefined);

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {error ? <Alert>{error}</Alert> : null}

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
        <SignupForm />
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
