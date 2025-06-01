"use client";

import { useNavigate } from "@tanstack/react-router";
import { redirectToAuth } from "../lib/auth";
import useAuth from "./useAuth";

// TODO: this is not how this should be implemented
export default function useAuthRequired() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  if (!isLoggedIn) {
    const url = new URL(window.location.href);
    redirectToAuth({
      pathname: url.pathname,
      searchParams: new URLSearchParams(url.search),
    });
  }
}

export function useModRequired() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    const url = new URL(window.location.href);
    redirectToAuth({
      pathname: url.pathname,
      searchParams: new URLSearchParams(url.search),
    });
  }

  if (!user?.mod && !user?.admin) {
    navigate({ to: "/login" });
  }
}

export function useAdminRequired() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    const url = new URL(window.location.href);
    redirectToAuth({
      pathname: url.pathname,
      searchParams: new URLSearchParams(url.search),
    });
  }

  if (!user?.admin) {
    navigate({ to: "/login" });
  }
}

export function useVerifiedRequired() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    const url = new URL(window.location.href);
    redirectToAuth({
      pathname: url.pathname,
      searchParams: new URLSearchParams(url.search),
    });
  }

  if (!user?.verified) {
    navigate({ to: "/verify", search: {} });
  }
}
