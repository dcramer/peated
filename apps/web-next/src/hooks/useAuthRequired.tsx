"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { redirectToAuth } from "../lib/auth";
import useAuth from "./useAuth";

export default function useAuthRequired() {
  const { isLoggedIn } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!isLoggedIn) {
    redirectToAuth({
      pathname,
      searchParams,
    });
  }
}
