"use client";

import { useORPC } from "@peated/web/lib/orpc/context";
import { requireReleaseFamilyAnchor } from "@peated/web/lib/releaseFamily";
import type { ComponentProps } from "react";
import SelectField from "./selectField";
import type { Option } from "./selectField/types";

export type BottleGroupOption = Option & {
  id: number;
  fullName: string;
  name: string;
  representativeBottleId: number;
};

export function formatBottleGroupOptionName({
  fullName,
  representativeBottleId,
  totalBottles,
}: {
  fullName: string;
  representativeBottleId: number;
  totalBottles: number;
}) {
  return `${fullName} · representative Bottle ${representativeBottleId} (${totalBottles} ${totalBottles === 1 ? "release" : "releases"})`;
}

type Props = Omit<
  ComponentProps<typeof SelectField<BottleGroupOption>>,
  "multiple" | "onChange" | "onQuery" | "value"
> & {
  value?: BottleGroupOption | null;
  onChange?: (value: BottleGroupOption | undefined) => void;
};

export default function BottleGroupField(props: Props) {
  const orpc = useORPC();

  return (
    <SelectField<BottleGroupOption>
      onQuery={async (query) => {
        const { results } = await orpc.bottleGroups.list.call({
          query,
          sort: "name",
        });
        return results.map(({ group }) => {
          const representativeBottleId = requireReleaseFamilyAnchor(group);
          return {
            id: group.id,
            fullName: group.fullName,
            representativeBottleId,
            name: formatBottleGroupOptionName({
              fullName: group.fullName,
              representativeBottleId,
              totalBottles: group.totalBottles,
            }),
          };
        });
      }}
      {...props}
    />
  );
}
