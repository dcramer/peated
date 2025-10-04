import Button from "@peated/web/components/button";
import LayoutSplash from "@peated/web/components/layoutSplash";
import Link from "@peated/web/components/link";
import { getSafeRedirect } from "@peated/web/lib/auth";
import type { Metadata } from "next";
import Actions from "./actions";

export const metadata: Metadata = {
  title: "Terms Required",
};

export default function TOSRequired({
  searchParams,
}: {
  searchParams: { redirectTo?: string };
}) {
  const redirectTo = getSafeRedirect(searchParams?.redirectTo ?? "/");
  return (
    <LayoutSplash>
      <div className="mb-16 flex flex-col items-center">
        <h1 className="mb-4 text-2xl font-semibold">
          Terms of Service Required
        </h1>
        <p className="text-muted max-w-md text-center">
          To continue, you need to review and accept the latest Terms of
          Service.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button href="/terms" color="highlight" fullWidth>
          Review Terms
        </Button>
        <Actions redirectTo={redirectTo} />
        <div className="text-center text-sm text-slate-400">
          Have questions?{" "}
          <Link href="/terms" className="text-highlight underline">
            View terms
          </Link>
          .
        </div>
      </div>
    </LayoutSplash>
  );
}
