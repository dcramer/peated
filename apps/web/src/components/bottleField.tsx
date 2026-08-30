"use client";

import {
  formatBottleDisplayName,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import { useORPC } from "@peated/web/lib/orpc/context";
import type { ComponentProps } from "react";
import SelectField from "./selectField";

type BottleListItem = Outputs["bottles"]["list"]["results"][number];
export type BottleOption = Pick<BottleListItem, "id"> & { name: string };

export function formatBottleOptionWithId(
  bottle: BottleDisplayNameSource & Pick<BottleListItem, "id">,
): string {
  return `${formatBottleDisplayName(bottle)} · Bottle ${bottle.id}`;
}

export default function BottleField({
  formatOptionName,
  ...props
}: ComponentProps<typeof SelectField<BottleOption>> & {
  formatOptionName?: (bottle: BottleListItem) => string;
}) {
  const orpc = useORPC();
  return (
    <SelectField<BottleOption>
      onQuery={async (query) => {
        const { results } = await orpc.bottles.list.call({ query });
        return results.map((r) => ({
          name: formatOptionName?.(r) ?? formatBottleDisplayName(r),
          id: r.id,
        }));
      }}
      {...props}
    />
  );
}
