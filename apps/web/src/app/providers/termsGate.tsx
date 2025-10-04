"use client";

import useAuth from "@peated/web/hooks/useAuth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

const ALLOWED_PATHS = [
  "/auth/tos-required",
  "/login",
  "/register",
  "/logout",
  "/auth/magic-link",
  "/terms",
];

export default function TermsGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    if (!user) return; // only gate authenticated users
    // If terms not accepted, block navigation to non-allowed routes
    // termsAcceptedAt may be undefined until acceptance
    const accepted = Boolean(user.termsAcceptedAt);
    if (accepted) return;

    const isAllowed = ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      const redirectTo = `${pathname}${search?.toString() ? `?${search.toString()}` : ""}`;
      router.replace(
        `/auth/tos-required?redirectTo=${encodeURIComponent(redirectTo)}`,
      );
    }
  }, [user, pathname, search, router]);

  return <>{children}</>;
}
