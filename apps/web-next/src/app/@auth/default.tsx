"use client";

import useAuth from "@peated/web-next/hooks/useAuth";
import { redirectToAuth } from "@peated/web-next/lib/auth";
import { usePathname, useSearchParams } from "next/navigation";

export default function Page() {
  const { isLoggedIn } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!isLoggedIn) {
    redirectToAuth({ pathname, searchParams });
  }

  return null;
}
