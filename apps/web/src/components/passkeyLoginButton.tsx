"use client";

import Button from "@peated/web/components/button";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function PasskeyLoginButton({
  action,
}: {
  action: (formData: FormData) => Promise<any>;
}) {
  const orpc = useORPC();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const authenticateChallengeMutation = useMutation(
    orpc.auth.passkey.authenticateChallenge.mutationOptions(),
  );

  const handlePasskeyLogin = async () => {
    // Check for WebAuthn support
    if (
      typeof window === "undefined" ||
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential !== "function"
    ) {
      router.push("/browser-not-supported");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get authentication options from server
      const { options, signedChallenge } =
        await authenticateChallengeMutation.mutateAsync({});

      // Start WebAuthn authentication
      const response = await startAuthentication({ optionsJSON: options });

      // Prepare form data for server action
      const formData = new FormData();
      formData.append("passkeyResponse", JSON.stringify(response));
      formData.append("signedChallenge", signedChallenge);
      if (searchParams.get("redirectTo")) {
        formData.append("redirectTo", searchParams.get("redirectTo") as string);
      }

      const result = await action(formData);

      // Check if the action returned an error
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
      // If no error, the action will redirect, so we don't need to do anything
    } catch (err: any) {
      logError(err, { context: "passkey_authentication" });

      // Check if user cancelled the passkey prompt
      if (err.name === "NotAllowedError" || err.message?.includes("cancel")) {
        // User cancelled, just re-enable the form without showing an error
        setLoading(false);
        return;
      }

      setError(err.message || "Failed to authenticate with passkey");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        fullWidth
        color="primary"
        onClick={handlePasskeyLogin}
        loading={loading}
      >
        <KeyRound className="mr-2 h-4 w-4" />
        Sign in with Passkey
      </Button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </>
  );
}
