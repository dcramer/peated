"use client";

import { ButtonLink } from "@peated/web/components/designSystem/components";
import {
  AuthNotice,
  AuthPanel,
} from "@peated/web/components/designSystem/patterns/authShell.stylex";
import { ProductAuthShell } from "@peated/web/components/designSystem/product/authPageShell.stylex";
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
      <AuthPanel
        description="This usually takes only a moment."
        title="Verifying your account"
      >
        <AuthNotice>Checking your verification link…</AuthNotice>
      </AuthPanel>
    );
  } else if (error) {
    panel = (
      <AuthPanel
        description="The link may have expired or already been used."
        title="We couldn’t verify this account"
      >
        <AuthNotice>{error}</AuthNotice>
        <ResendVerificationForm />
      </AuthPanel>
    );
  } else if (success) {
    panel = (
      <AuthPanel
        description="Your email address is confirmed."
        title="Account verified"
      >
        <ButtonLink align="start" fullWidth href="/" size="lg" variant="accent">
          Return to Peated
        </ButtonLink>
      </AuthPanel>
    );
  } else {
    panel = (
      <AuthPanel
        description="Use the link in your inbox to finish setting up your account."
        title="Check your email"
      >
        <ResendVerificationForm />
      </AuthPanel>
    );
  }

  return <ProductAuthShell intro="account">{panel}</ProductAuthShell>;
}
