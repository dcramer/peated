"use client";

import type { Flight } from "@peated/server/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReportContentDialog } from "@peated/web/components/reportContentDialog";
import {
  RowMenu,
  type RowMenuItem,
} from "@peated/web/components/rowMenu.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

export function FlightActions({ flight }: { flight: Flight }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const deleteFlight = useMutation(orpc.flights.delete.mutationOptions());
  const [reporting, setReporting] = useState(false);

  if (!user) return null;
  const isOwner = user.id === flight.createdBy?.id;

  const groups: RowMenuItem[][] = [];
  if (user.mod || isOwner) {
    groups.push([{ href: `/flights/${flight.id}/edit`, label: "Edit flight" }]);
  }
  if (user.admin) {
    groups.push([
      {
        disabled: deleteFlight.isPending,
        label: "Delete flight",
        onSelect: async () => {
          if (!window.confirm(`Delete ${flight.name}?`)) return;
          await deleteFlight.mutateAsync({ flight: flight.id });
          router.push("/flights");
        },
      },
    ]);
  }
  if (!isOwner) {
    groups.push([
      { label: "Report flight", onSelect: () => setReporting(true) },
    ]);
  }

  return (
    <>
      <RowMenu groups={groups} label={flight.name} variant="page" />
      <ReportContentDialog
        isOpen={reporting}
        onClose={() => setReporting(false)}
        subject="this flight"
        target={{ objectType: "flight", objectId: flight.id }}
      />
    </>
  );
}
