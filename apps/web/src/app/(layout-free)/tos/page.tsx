import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import { getSafeRedirect } from "@peated/web/lib/auth";
import { acceptTosForm, logoutForm } from "@peated/web/lib/auth.actions";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { redirect } from "next/navigation";
import { useFormState } from "react-dom";

export default async function TosPage({
  searchParams,
}: {
  searchParams?: { redirectTo?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.tosAcceptedAt) {
    redirect(getSafeRedirect(searchParams?.redirectTo ?? "/"));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center p-6">
      <div className="w-full rounded bg-slate-900 p-6 ring-1 ring-slate-800">
        <h1 className="mb-2 text-xl font-semibold">Terms of Service</h1>
        <p className="mb-4 text-sm text-slate-300">
          You must agree to our{" "}
          <Link
            href="https://peated.com/terms"
            className="text-highlight underline"
          >
            Terms of Service
          </Link>{" "}
          to continue.
        </p>
        <Actions />
      </div>
    </div>
  );
}

function Actions() {
  const [acceptState, acceptAction] = useFormState(acceptTosForm, undefined);
  const [logoutState, logoutAction] = useFormState(logoutForm, undefined);
  return (
    <div className="flex justify-between">
      <form action={logoutAction}>
        <Button color="default" variant="outline">
          Log out
        </Button>
      </form>
      <form action={acceptAction}>
        <Button color="highlight">Accept and continue</Button>
      </form>
    </div>
  );
}
