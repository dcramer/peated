"use client";

import Spinner from "@peated/web/components/spinner";
import { redirect, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { redirectToAuth } from "../lib/auth";
import useAuth from "./useAuth";

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

  return true;
}

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

  return true;
}

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

  return true;
}

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

  return true;
}

export function AuthRequired({ children }: { children: ReactNode }) {
  return useAuthRequired() ? <>{children}</> : <Spinner />;
}

export function ModRequired({ children }: { children: ReactNode }) {
  return useModRequired() ? <>{children}</> : <Spinner />;
}

export function VerifiedRequired({ children }: { children: ReactNode }) {
  return useVerifiedRequired() ? <>{children}</> : <Spinner />;
}
