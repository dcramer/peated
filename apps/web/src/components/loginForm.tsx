"use client";

import React from "react";

import Button from "@peated/web/components/button";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import Link from "@peated/web/components/link";
import TextField from "@peated/web/components/textField";
import config from "@peated/web/config";
import {
  authenticate,
  authenticateForm,
  resendMagicLinkForm,
} from "@peated/web/lib/auth.actions";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";
import OTPInput from "./otpInput";

function FormComponent() {
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
        <Button type="submit" color="highlight" fullWidth loading={pending}>
          Continue
        </Button>
      </div>
    </>
  );
}

export default function LoginForm() {
  const [result, formAction] = useFormState(authenticateForm, undefined);
  const [persisted, setPersisted] = React.useState<null | {
    requestId: string;
    expiresIn: number;
  }>(null);
  const searchParams = useSearchParams();

  // Restore pending request from sessionStorage on mount
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("loginRequest");
      if (!raw) return;
      const data = JSON.parse(raw) as { requestId: string; expiresAt: number };
      const remaining = Math.max(
        0,
        Math.floor((data.expiresAt - Date.now()) / 1000),
      );
      if (remaining > 0)
        setPersisted({ requestId: data.requestId, expiresIn: remaining });
      else sessionStorage.removeItem("loginRequest");
    } catch {
      // Ignore sessionStorage errors (quota, parsing, disabled)
    }
  }, []);

  // Persist when server responds with a new request
  React.useEffect(() => {
    if (result?.magicLink && result?.requestId && result?.expiresIn) {
      const expiresAt = Date.now() + result.expiresIn * 1000;
      try {
        sessionStorage.setItem(
          "loginRequest",
          JSON.stringify({ requestId: result.requestId, expiresAt }),
        );
      } catch {
        // Ignore sessionStorage errors (quota, disabled)
      }
      setPersisted({
        requestId: result.requestId,
        expiresIn: result.expiresIn,
      });
    }
  }, [result?.magicLink, result?.requestId, result?.expiresIn]);

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {result?.error ? <Alert>{result.error}</Alert> : null}

      {result?.magicLink || persisted ? (
        <MagicCodeSection
          formAction={formAction}
          result={
            result?.magicLink
              ? result
              : {
                  magicLink: true,
                  requestId: persisted?.requestId,
                  expiresIn: persisted?.expiresIn,
                }
          }
          onClearPersist={() => sessionStorage.removeItem("loginRequest")}
          onExtend={(seconds) => {
            try {
              const raw = sessionStorage.getItem("loginRequest");
              if (!raw) return;
              const data = JSON.parse(raw) as {
                requestId: string;
                expiresAt: number;
              };
              data.expiresAt = Date.now() + seconds * 1000;
              sessionStorage.setItem("loginRequest", JSON.stringify(data));
            } catch {
              // Ignore sessionStorage errors (quota, parsing, disabled)
            }
          }}
        />
      ) : (
        <>
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
                  <span className="bg-slate-900 px-2 text-lg uppercase">
                    Or
                  </span>
                </div>
              </div>
            </>
          )}

          <form action={formAction}>
            <FormComponent />
          </form>

          <div className="mt-4 flex items-center justify-center gap-x-3 text-sm">
            <div>
              Don't have an account yet?{" "}
              <Link href="/register" className="text-highlight underline">
                Sign Up
              </Link>
            </div>
            <div>&middot;</div>
            <div>
              <Link href="/password-reset" className="text-highlight underline">
                Password Reset
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ResendSection({
  requestId,
  onResent,
}: {
  requestId: string;
  onResent: (expiresIn: number) => void;
}) {
  "use client";
  const [state, formAction] = (useFormState as any)(
    resendMagicLinkForm as any,
    undefined,
  );
  const { pending } = useFormStatus();
  React.useEffect(() => {
    if ((state as any)?.expiresIn) onResent((state as any).expiresIn);
  }, [state, onResent]);
  return (
    <div className="mt-4 text-center text-sm text-slate-400">
      Didn’t receive it?
      <form action={formAction} className="mt-2 inline-block">
        <input type="hidden" name="requestId" value={requestId} />
        <Button type="submit" size="small" disabled={pending}>
          {pending ? "Resending…" : "Resend code"}
        </Button>
      </form>
      {state?.error && <div className="mt-2 text-red-400">{state.error}</div>}
      {state?.ok && (
        <div className="mt-2 text-green-400">Code sent. Check your email.</div>
      )}
    </div>
  );
}

function MagicCodeSection({
  formAction,
  result,
  onClearPersist,
  onExtend,
}: {
  formAction: (payload: FormData) => void;
  result: any;
  onClearPersist: () => void;
  onExtend: (seconds: number) => void;
}) {
  "use client";
  const searchParams = useSearchParams();
  const [seconds, setSeconds] = React.useState<number>(
    result?.expiresIn ?? 600,
  );
  const [codeValue, setCodeValue] = React.useState("");
  const expired = seconds <= 0;

  React.useEffect(() => {
    setSeconds(result?.expiresIn ?? 600);
  }, [result?.expiresIn]);

  React.useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      <p className="text-center font-bold">We emailed you a sign-in code.</p>
      <p className="mb-2 text-center text-slate-400">
        Enter the 6-digit code below. Expires in {mm}:{ss}.
      </p>
      {expired && (
        <p className="mb-2 text-center text-amber-400">
          This code expired. Resend a new one.
        </p>
      )}

      <form
        action={formAction}
        className="-mx-4"
        onSubmit={() => {
          try {
            onClearPersist();
          } catch {
            // Ignore sessionStorage errors
          }
        }}
      >
        <input
          type="hidden"
          name="redirectTo"
          value={searchParams.get("redirectTo") ?? "/"}
        />
        <input type="hidden" name="requestId" value={result.requestId ?? ""} />
        <div className="mb-2">
          <label className="mb-2 block font-bold">Code</label>
          <OTPInput autoFocus name="code" onChange={setCodeValue} />
        </div>
        <div className="mb-4 text-sm text-slate-400">
          Check your email for the code, or tap the link to complete
          automatically.
        </div>
        <div className="flex justify-center gap-x-2">
          <Button
            type="submit"
            color="highlight"
            fullWidth
            disabled={expired || codeValue.length !== 6}
          >
            Verify Code
          </Button>
        </div>
      </form>
      <ResendSection
        requestId={result.requestId ?? ""}
        onResent={(newExp) => {
          setSeconds(newExp);
          onExtend(newExp);
        }}
      />
      <div className="mt-4 text-center text-sm">
        <Link
          href={`/login?redirectTo=${encodeURIComponent(searchParams.get("redirectTo") ?? "/")}`}
          className="text-highlight underline"
        >
          Change email
        </Link>
      </div>
    </>
  );
}
