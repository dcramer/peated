"use client";

import { useORPC } from "@peated/web/lib/orpc/context";
import SelectField from "./selectField";

export default function BottleField({
  ...props
}: React.ComponentProps<typeof SelectField>) {
  const orpc = useORPC();
  return (
    <SelectField
      onQuery={async (query) => {
        const { results } = await orpc.bottles.list.call({ query });
        return results.map((r) => ({
          name: r.edition ? `${r.fullName} (${r.edition})` : r.fullName,
          id: r.id,
        }));
      }}
      {...props}
    />
  );
}
