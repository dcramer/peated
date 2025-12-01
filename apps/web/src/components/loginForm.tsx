"use client";

import Button from "@peated/web/components/button";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import Link from "@peated/web/components/link";
import PasskeyLoginButton from "@peated/web/components/passkeyLoginButton";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import { authenticate, authenticateForm } from "@peated/web/lib/auth.actions";
import { Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";

function FormComponent({ showPassword }: { showPassword: boolean }) {
  const { pending } = useFormStatus();
  const [showPasswordField, setShowPasswordField] = useState(showPassword);
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
          autoFocus
        />
        {showPasswordField && (
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />
        )}
        {!showPasswordField && (
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setShowPasswordField(true)}
              className="text-highlight text-sm underline"
            >
              Or sign in with a password
            </button>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-x-2">
        <Button type="submit" color="highlight" fullWidth loading={pending}>
          Continue
        </Button>
      </div>
    </>
  );
}

export default function LoginForm() {
  const [result, formAction] = useFormState(authenticateForm, undefined);
  const [showEmailForm, setShowEmailForm] = useState(false);

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {result?.error ? <Alert>{result.error}</Alert> : null}

      {result?.magicLink ? (
        <p className="mb-8 text-center font-bold">
          Please check your email to continue.
        </p>
      ) : showEmailForm ? (
        <>
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="text-highlight text-sm underline"
            >
              ← Back to other options
            </button>
          </div>

          <form action={formAction}>
            <FormComponent showPassword={false} />
          </form>

          <div className="mt-4 flex items-center justify-center gap-x-3 text-center text-sm">
            <div>
              Don't have an account yet?{" "}
              <Link href="/register" className="text-highlight underline">
                Sign Up
              </Link>
            </div>
            <div>&middot;</div>
            <div>
              <Link
                href="/recover-account"
                className="text-highlight underline"
              >
                Account Recovery
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <PasskeyLoginButton action={authenticate} />

          {config.GOOGLE_CLIENT_ID && (
            <GoogleLoginButton action={authenticate} />
          )}

          <Button
            fullWidth
            color="primary"
            onClick={() => setShowEmailForm(true)}
          >
            <Mail className="mr-2 h-4 w-4" />
            Sign in with Email
          </Button>

          <div className="mt-4 flex items-center justify-center gap-x-3 text-sm">
            <div>
              Don't have an account yet?{" "}
              <Link href="/register" className="text-highlight underline">
                Sign Up
              </Link>
            </div>
            <div>&middot;</div>
            <div>
              <Link
                href="/recover-account"
                className="text-highlight underline"
              >
                Account Recovery
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
