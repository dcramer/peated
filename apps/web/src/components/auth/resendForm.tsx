import Button from "@peated/web/components/button";
import { resendVerification } from "@peated/web/lib/auth.actions";
import { useState } from "react";
import Alert from "../alert";

export default function ResendVerificationForm() {
  const [result, setResult] = useState<{
    ok?: boolean;
    alreadyVerified?: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-y-4">
      {result?.error && <Alert>{result.error}</Alert>}

      {result?.ok ? (
        result.alreadyVerified ? (
          <p className="mb-8 text-center font-bold">
            Your email has already been verified.
          </p>
        ) : (
          <p className="mb-8 text-center font-bold">
            Please check your email again to continue.
          </p>
        )
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
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
        >
          <Button type="submit" color="primary" fullWidth disabled={loading}>
            {loading ? "Sending..." : "Resend Verification Email"}
          </Button>
        </form>
      )}
    </div>
  );
}
