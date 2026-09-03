"use client";

import {
  formatBottleDisplayName,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import { toBottlePickerOption } from "@peated/web/lib/bottleListItem";
import { useORPC } from "@peated/web/lib/orpc/context";
import type { ComponentProps } from "react";
import type { SearchPickerOption } from "./searchPicker.stylex";
import SelectField from "./selectField";

type BottleListItem = Outputs["bottles"]["list"]["results"][number];
export type BottleOption = Pick<BottleListItem, "id"> & {
  name: string;
  bottle: NonNullable<SearchPickerOption["bottle"]>;
};

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
        return results.map((r) => {
          const option = toBottlePickerOption(r);
          const name = formatOptionName?.(r) ?? option.label;
          return { name, id: r.id, bottle: { ...option.bottle, name } };
        });
      }}
      {...props}
    />
  );
}
