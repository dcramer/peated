"use client";

import { ButtonLink } from "@peated/web/components";
import { AuthenticationPage } from "@peated/web/components/auth/authenticationPage.stylex";
import {
  AuthenticationNotice,
  AuthenticationPanel,
} from "@peated/web/components/pages/authentication.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { updateSession } from "@peated/web/lib/auth.actions";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { redirect, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ResendVerificationForm from "./resendForm";

export default function Verify() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const orpc = useORPC();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { mutate: verifyEmail } = useMutation(
    orpc.email.verify.mutationOptions({
      onSuccess: async () => {
        setSuccess(true);
        await updateSession();
      },
    }),
  );

  if (user?.verified || (!user && !token)) {
    redirect("/");
  }

  useEffect(() => {
    if (!token) return;
    verifyEmail(
      { token },
      {
        onError: (requestError: any) => {
          if (
            requestError.name === "INVALID_TOKEN" ||
            requestError.message?.includes("Invalid verification token")
          ) {
            setError("This verification link has expired or is invalid.");
          } else {
            logError(requestError);
            setError("An unknown internal error occurred.");
          }
          setLoading(false);
        },
        onSuccess: () => {
          setLoading(false);
        },
      },
    );
  }, [token, verifyEmail]);

  let panel;
  if (loading) {
    panel = (
      <AuthenticationPanel
        description="This usually takes only a moment."
        title="Verifying your account"
      >
        <AuthenticationNotice>
          Checking your verification link…
        </AuthenticationNotice>
      </AuthenticationPanel>
    );
  } else if (error) {
    panel = (
      <AuthenticationPanel
        description="The link may have expired or already been used."
        title="We couldn’t verify this account"
      >
        <AuthenticationNotice>{error}</AuthenticationNotice>
        <ResendVerificationForm />
      </AuthenticationPanel>
    );
  } else if (success) {
    panel = (
      <AuthenticationPanel
        description="Your email address is confirmed."
        title="Account verified"
      >
        <ButtonLink align="start" fullWidth href="/" size="lg" variant="accent">
          Return to Peated
        </ButtonLink>
      </AuthenticationPanel>
    );
  } else {
    panel = (
      <AuthenticationPanel
        description="Use the link in your inbox to finish setting up your account."
        title="Check your email"
      >
        <ResendVerificationForm />
      </AuthenticationPanel>
    );
  }

  return <AuthenticationPage intro="account">{panel}</AuthenticationPage>;
}
