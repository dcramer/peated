"use client";

import Button from "@peated/web/components/button";
import TextField from "@peated/web/components/textField";
import { passwordResetConfirm } from "@peated/web/lib/auth.actions";
import { useState } from "react";
import Alert from "./alert";

export default function PasswordResetChangeForm({ token }: { token: string }) {
  const [result, setResult] = useState<{
    ok?: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-w-sm flex-auto flex-col gap-y-4">
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.ok ? (
        <>
          <p className="mb-8 text-center">Your password has been changed.</p>
          <Button to="/" color="highlight">
            Return to Peated
          </Button>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const formData = new FormData(e.target as HTMLFormElement);
            try {
              const response = await passwordResetConfirm({
                data: {
                  token,
                  password: formData.get("password") as string,
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
            <TextField
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="************"
              autoFocus
            />
          </div>
          <div className="flex justify-center gap-x-2">
            <Button
              type="submit"
              color="highlight"
              fullWidth
              disabled={loading}
            >
              {loading ? "Updating..." : "Continue"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
