"use client";

import type { Flight } from "@peated/server/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { RowMenu } from "@peated/web/components";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

export function FlightActions({ flight }: { flight: Flight }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const deleteFlight = useMutation(orpc.flights.delete.mutationOptions());

  if (!user || (!user.mod && user.id !== flight.createdBy?.id)) return null;
  const canDelete = user.admin;

  return (
    <RowMenu
      groups={[
        [{ href: `/flights/${flight.id}/edit`, label: "Edit flight" }],
        ...(canDelete
          ? [
              [
                {
                  disabled: deleteFlight.isPending,
                  label: "Delete flight",
                  onSelect: async () => {
                    if (!window.confirm(`Delete ${flight.name}?`)) return;
                    await deleteFlight.mutateAsync({ flight: flight.id });
                    router.push("/flights");
                  },
                },
              ],
            ]
          : []),
      ]}
      label={flight.name}
      variant="page"
    />
  );
}
