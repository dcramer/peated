import Button from "@peated/web/components/button";
import LayoutSplash from "@peated/web/components/layoutSplash";
import { updateSession } from "@peated/web/lib/auth.actions";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { logError } from "@peated/web/lib/log";
import { isTRPCClientError } from "@peated/web/lib/trpc/client";
import { getUnsafeTrpcClient } from "@peated/web/lib/trpc/client.server";
import { redirect } from "next/navigation";
import ResendVerificationForm from "./resendForm";

export default async function Verify({
  searchParams,
}: {
  searchParams: Record<string, any>;
}) {
  let error = "";
  let success = false;

  const user = await getCurrentUser();
  if (user?.verified) {
    return redirect("/");
  }

  const token = searchParams.token;
  if (token) {
    const trpcClient = await getUnsafeTrpcClient();
    try {
      await trpcClient.mutation("emailVerify", token);
      await updateSession();
      success = true;
    } catch (err) {
      if (isTRPCClientError(err)) {
        error = err.message;
      } else {
        logError(err);
        error = "An unknown internal error occurred.";
      }
    }
  } else if (!user) {
    return redirect("/login");
  }

  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">Account Verification</h1>
        {error ? (
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
