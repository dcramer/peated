"use client";

import Link from "@peated/web/components/link";
import PasskeyRegisterButton from "@peated/web/components/passkeyRegisterButton";
import TextField from "@peated/web/components/textField";
import { authenticate, register } from "@peated/web/lib/auth.actions";
import { useState } from "react";
import config from "../config";
import Alert from "./alert";
import GoogleLoginButton from "./googleLoginButton";

export default function RegisterForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
        />
        <TextField
          className="py-3"
          name="username"
          label="Username"
          autoComplete="username"
          required
          placeholder="you99"
          value={username}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setUsername(e.target.value)
          }
        />
        <label className="relative mb-3 block flex items-start gap-2 px-4 py-3 text-sm">
          <input
            type="checkbox"
            name="tosAccepted"
            required
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-highlight underline">
              Terms of Service
            </Link>
            .
          </span>
        </label>
      </div>

      <PasskeyRegisterButton
        action={register}
        username={username}
        email={email}
        tosAccepted={tosAccepted}
        onError={setError}
      />

      <p className="mt-4 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-highlight underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}
