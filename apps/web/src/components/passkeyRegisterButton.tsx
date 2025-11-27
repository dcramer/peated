"use client";

import Button from "@peated/web/components/button";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasskeyRegisterButton({
  action,
  username,
  email,
  tosAccepted,
  onError,
}: {
  action: (formData: FormData) => Promise<any>;
  username: string;
  email: string;
  tosAccepted: boolean;
  onError?: (error: string) => void;
}) {
  const orpc = useORPC();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const registerChallengeMutation = useMutation(
    orpc.auth.registerChallenge.mutationOptions(),
  );

  const handlePasskeyRegister = async () => {
    // Validate inputs before proceeding
    if (!username.trim() || !email.trim() || !tosAccepted) {
      return;
    }

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

    try {
      // Get WebAuthn challenge from server
      const { options, signedChallenge } =
        await registerChallengeMutation.mutateAsync({
          username: username.trim(),
          email: email.trim(),
        });

      // Start WebAuthn registration
      const response = await startRegistration({ optionsJSON: options });

      // Prepare form data for server action
      const formData = new FormData();
      formData.append("passkeyResponse", JSON.stringify(response));
      formData.append("signedChallenge", signedChallenge);
      formData.append("username", username.trim());
      formData.append("email", email.trim());
      formData.append("tosAccepted", "true");

      const result = await action(formData);

      // Check if the action returned an error
      if (result?.error) {
        onError?.(result.error);
        setLoading(false);
      }
      // If no error, the action will redirect, so we don't need to do anything
    } catch (err: any) {
      logError(err, { context: "passkey_registration" });

      // Check if user cancelled the passkey prompt
      if (err.name === "NotAllowedError" || err.message?.includes("cancel")) {
        // User cancelled, just re-enable the form without showing an error
        setLoading(false);
        return;
      }

      // Handle ORPC validation errors
      let errorMessage = "Failed to register with passkey";
      if (err.message) {
        errorMessage = err.message;
      }
      // Check if it's a validation error with zodError
      if (err.zodError) {
        try {
          const zodErrors = JSON.parse(err.zodError);
          if (zodErrors && zodErrors.length > 0) {
            errorMessage = zodErrors.map((e: any) => e.message).join(", ");
          }
        } catch (e) {
          // If we can't parse zodError, use the main error message
        }
      }

      onError?.(errorMessage);
      setLoading(false);
    }
  };

  const isDisabled =
    !tosAccepted ||
    username.trim().length === 0 ||
    email.trim().length === 0 ||
    loading;

  return (
    <Button
      fullWidth
      color="highlight"
      onClick={handlePasskeyRegister}
      loading={loading}
      disabled={isDisabled}
    >
      <KeyRound className="mr-2 h-4 w-4" />
      Sign Up with Passkey
    </Button>
  );
}
