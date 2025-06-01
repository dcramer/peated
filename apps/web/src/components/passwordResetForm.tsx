import Button from "@peated/web/components/button";
import TextField from "@peated/web/components/textField";
import { passwordReset } from "@peated/web/lib/auth.actions";
import { useState } from "react";
import Alert from "./alert";

export default function PasswordResetForm() {
  const [result, setResult] = useState<{
    ok?: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-y-4">
      {result?.error && <Alert>{result.error}</Alert>}

      {result?.ok ? (
        <p className="mb-8 text-center font-bold">
          Please check your email to continue.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const formData = new FormData(e.target as HTMLFormElement);
            try {
              const response = await passwordReset({
                data: { email: formData.get("email") as string },
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
            <TextField
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              autoFocus
            />
          </div>
          <div className="flex justify-center gap-x-2">
            <Button type="submit" color="primary" fullWidth disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
