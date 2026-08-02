"use client";

import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";

export default function useBottleCheckCapabilities() {
  const orpc = useORPC();
  const { data } = useQuery(orpc.root.queryOptions());

  return (
    data?.capabilities ?? {
      bottleAudits: false,
      bottleCheckExecution: false,
      bottleChecks: false,
    }
  );
}
