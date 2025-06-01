"use client";

import Button from "@peated/web/components/button";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import { authenticate, register } from "@peated/web/lib/auth.actions";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import Alert from "./alert";

export default function RegisterForm() {
  const [result, setResult] = useState<{
    ok?: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-w-sm flex-auto flex-col gap-y-4">
      {result?.error && <Alert>{result.error}</Alert>}

      {config.GOOGLE_CLIENT_ID && (
        <>
          <GoogleLoginButton
            action={async (formData) => {
              try {
                const response = await authenticate({
                  data: {
                    code: formData.get("code") as string,
                  },
                });
                if (response?.error) {
                  setResult({ ok: false, error: response.error });
                }
                // If successful, authenticate will redirect automatically
              } catch (error) {
                setResult({ ok: false, error: "Authentication failed" });
              }
            }}
          />
          <div className="relative my-4 font-bold text-slate-500 opacity-60">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="min-w-full border-slate-700 border-t-2" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-900 px-2 text-lg uppercase">Or</span>
            </div>
          </div>
        </>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const formData = new FormData(e.target as HTMLFormElement);
          try {
            const response = await register({
              data: {
                email: formData.get("email") as string,
                password: formData.get("password") as string,
                username: formData.get("username") as string,
                redirectTo: formData.get("redirectTo") as string,
              },
            });
            setResult(response);
          } catch (error) {
            setResult({ ok: false, error: "An error occurred" });
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="-mx-4 -mt-4">
          <input type="hidden" name="redirectTo" value="/" />
          <TextField
            name="username"
            label="Username"
            type="text"
            autoComplete="username"
            required
            autoFocus
          />
          <TextField
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            helpText="Minimum 8 characters"
          />
        </div>
        <div className="flex justify-center gap-x-2">
          <Button type="submit" color="highlight" fullWidth disabled={loading}>
            {loading ? "Creating Account..." : "Continue"}
          </Button>
        </div>
      </form>

      <div className="mt-4 flex items-center justify-center gap-x-3 text-sm">
        <div>
          Already have an account?{" "}
          <Link to="/login" className="text-highlight underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
