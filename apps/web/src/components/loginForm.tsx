import Button from "@peated/web/components/button";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import { authenticate } from "@peated/web/lib/auth.actions";
import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import Alert from "./alert";

function FormComponent() {
  const searchParams = useSearch({ strict: false });

  return (
    <>
      <div className="-mx-4 -mt-4">
        <input
          type="hidden"
          name="redirectTo"
          value={(searchParams as any).redirectTo ?? "/"}
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
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          helpText="Enter your password, or alternatively continue without and we'll email you a magic link."
        />
      </div>
      <div className="flex justify-center gap-x-2">
        <Button type="submit" color="highlight" fullWidth>
          Continue
        </Button>
      </div>
    </>
  );
}

export default function LoginForm() {
  const [result, setResult] = useState<{
    error?: string;
    magicLink?: boolean;
  } | null>(null);

  return (
    <div className="flex min-w-sm flex-auto flex-col gap-y-4">
      {result?.error ? <Alert>{result.error}</Alert> : null}

      {result?.magicLink ? (
        <p className="mb-8 text-center font-bold">
          Please check your email to continue.
        </p>
      ) : (
        <>
          {config.GOOGLE_CLIENT_ID && (
            <>
              <GoogleLoginButton
                action={async (formData) => {
                  const result = await authenticate({
                    data: {
                      code: formData.get("code") as string,
                    },
                  });
                  setResult(result);
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
                  <span className="bg-slate-900 px-2 text-lg uppercase">
                    Or
                  </span>
                </div>
              </div>
            </>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const result = await authenticate({
                data: {
                  email: formData.get("email") as string,
                  password: formData.get("password") as string,
                  redirectTo: formData.get("redirectTo") as string,
                },
              });
              setResult(result);
            }}
          >
            <FormComponent />
          </form>

          <div className="mt-4 flex items-center justify-center gap-x-3 text-sm">
            <div>
              Don't have an account yet?{" "}
              <Link to="/register" className="text-highlight underline">
                Sign Up
              </Link>
            </div>
            <div>&middot;</div>
            <div>
              <Link to="/password-reset" className="text-highlight underline">
                Password Reset
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
