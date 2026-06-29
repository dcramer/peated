"use client";

import Spinner from "@peated/web/components/spinner";
import { redirect, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { redirectToAuth } from "../lib/auth";
import useAuth from "./useAuth";

/**
 * Redirects anonymous users to auth after the server session reaches the client.
 */
export default function useAuthRequired() {
  const { isLoading, isLoggedIn } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (isLoading) return false;

  if (!isLoggedIn) {
    redirectToAuth({
      pathname,
      searchParams,
    });
  }
}

/**
 * Redirects anonymous users to auth and non-moderators to the forbidden page.
 */
export function useModRequired() {
  const { isLoading, user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (isLoading) return false;

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

/**
 * Redirects anonymous users to auth and non-admins to the forbidden page.
 */
export function useAdminRequired() {
  const { isLoading, user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (isLoading) return false;

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

/**
 * Redirects anonymous users to auth and unverified users to verification.
 */
export function useVerifiedRequired() {
  const { isLoading, user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (isLoading) return false;

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

/**
 * Holds child hooks until the authenticated session is available client-side.
 */
export function AuthRequired({ children }: { children: ReactNode }) {
  if (useAuthRequired() === false) return <Spinner />;
  return <>{children}</>;
}

/**
 * Holds child hooks until a moderator session is available client-side.
 */
export function ModRequired({ children }: { children: ReactNode }) {
  if (useModRequired() === false) return <Spinner />;
  return <>{children}</>;
}

/**
 * Holds child hooks until a verified session is available client-side.
 */
export function VerifiedRequired({ children }: { children: ReactNode }) {
  if (useVerifiedRequired() === false) return <Spinner />;
  return <>{children}</>;
}
