"use client";

import { resendVerification } from "@peated/web/lib/auth.actions";
import { useState } from "react";
import Alert from "./alert";
import Button from "./button";

export default function PendingVerificationAlert() {
  const [result, setResult] = useState<{
    ok?: boolean;
    alreadyVerified?: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Alert>
      <div className="text-center">
        <p className="mb-4 font-bold">Please verify your email address.</p>
        {result?.error && <p className="mb-4 text-red-500">{result.error}</p>}
        {result?.ok ? (
          result.alreadyVerified ? (
            <p className="text-green-500">
              Your email has already been verified.
            </p>
          ) : (
            <p className="text-green-500">
              Please check your email again to continue.
            </p>
          )
        ) : (
          <Button
            onClick={async () => {
              setLoading(true);
              try {
                const response = await resendVerification();
                setResult(response);
              } catch (error) {
                setResult({ ok: false, error: "An error occurred" });
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            color="primary"
            size="small"
          >
            {loading ? "Sending..." : "Resend Verification Email"}
          </Button>
        )}
      </div>
    </Alert>
  );
}
