"use client";

import { redirect, usePathname, useSearchParams } from "next/navigation";
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

export function useModRequired() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!user) {
    redirectToAuth({
      pathname,
      searchParams,
    });
  }

  if (!user?.mod && !user?.admin) {
    redirect("/errors/unauthorized");
  }
}

export function useAdminRequired() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!user) {
    redirectToAuth({
      pathname,
      searchParams,
    });
  }

  if (!user?.admin) {
    redirect("/errors/unauthorized");
  }
}

export function useVerifiedRequired() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!user) {
    redirectToAuth({
      pathname,
      searchParams,
    });
  }

  if (!user?.verified) {
    redirect("/verify");
  }
}
