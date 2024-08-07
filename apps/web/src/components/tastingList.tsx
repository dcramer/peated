"use client";

import type { Tasting } from "@peated/server/types";
import { AnimatePresence } from "framer-motion";
import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";
import TastingListItem from "./tastingListItem";

export default function TastingList({
  values,
  ...props
}: Omit<
  ComponentPropsWithoutRef<typeof TastingListItem>,
  "tasting" | "onDelete"
> & {
  values: Tasting[];
}) {
  const [deletedValues, setDeletedValues] = useState<number[]>([]);

  const onDelete = (tasting: Tasting) => {
    setDeletedValues((arr) => [...arr, tasting.id]);
  };

  return (
    <ul className="mt-1">
      <AnimatePresence>
        {values
          .filter((t) => !deletedValues.includes(t.id))
          .map((tasting) => (
            <TastingListItem
              key={tasting.id}
              tasting={tasting}
              onDelete={onDelete}
              {...props}
            />
          ))}
      </AnimatePresence>
    </ul>
  );
}
