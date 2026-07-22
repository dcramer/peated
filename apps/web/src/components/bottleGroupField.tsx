"use client";

import { useORPC } from "@peated/web/lib/orpc/context";
import type { ComponentProps } from "react";
import SelectField from "./selectField";
import type { Option } from "./selectField/types";

export type BottleGroupOption = Option & {
  id: number;
  fullName: string;
  name: string;
};

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
        return results.map(({ group }) => ({
          id: group.id,
          fullName: group.fullName,
          name: `${group.fullName} (group ${group.id}, ${group.totalBottles} ${group.totalBottles === 1 ? "release" : "releases"})`,
        }));
      }}
      {...props}
    />
  );
}
