"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

let hydrating = true;

export function useHydrated() {
  const [hydrated, setHydrated] = useState(() => !hydrating);

  useEffect(function hydrate() {
    hydrating = false;
    setHydrated(true);
  }, []);

  return hydrated;
}

type Props = {
  children(): ReactNode;
  fallback?: ReactNode;
};

export function ClientOnly({ children, fallback = null }: Props) {
  return useHydrated() ? <>{children()}</> : <>{fallback}</>;
}
