"use client";

import Button from "@peated/web/components/button";
import LayoutSplash from "@peated/web/components/layoutSplash";
import Spinner from "@peated/web/components/spinner";
import useAuth from "@peated/web/hooks/useAuth";
import { updateSession } from "@peated/web/lib/auth.actions";
import { logError } from "@peated/web/lib/log";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc/client";
import { redirect, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ResendVerificationForm from "./resendForm";

export default function Verify() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const emailVerifyMutation = trpc.emailVerify.useMutation({
    onSuccess: async () => {
      setSuccess(true);
      await updateSession();
    },
  });

  const token = searchParams.get("token") || "";
  if (user?.verified || (!user && !token)) {
    redirect("/");
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    emailVerifyMutation.mutate(token, {
      onError: (err) => {
        if (isTRPCClientError(err)) {
          setError(err.message);
        } else {
          logError(err);
          setError("An unknown internal error occurred.");
        }
        setLoading(false);
      },
      onSuccess: () => {
        setLoading(false);
      },
    });
  }, [token]);

  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Account Verification</h1>
        {loading ? (
          <Spinner />
        ) : error ? (
          <>
            <p className="mb-4 text-center">
              There was an error verifying your account.
            </p>
            <p className="mb-4 text-center">
              The error returned was: <em>{error}</em>
            </p>
            <ResendVerificationForm />
          </>
        ) : success ? (
          <>
            <p className="mb-8 text-center">Your account has been verified.</p>
            <Button href="/" color="highlight">
              Return to Peated
            </Button>
          </>
        ) : (
          <>
            <p className="mb-8 text-center">
              Please check your email address to finish verifying your account.
            </p>
            <ResendVerificationForm />
          </>
        )}
      </div>
    </LayoutSplash>
  );
}
