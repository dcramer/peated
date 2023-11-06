import type { Tasting } from "@peated/server/types";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import TastingListItem from "./tastingListItem";

export default function TastingList({
  values,
  noBottle,
}: {
  values: Tasting[];
  noBottle?: boolean;
}) {
  const [deletedValues, setDeletedValues] = useState<number[]>([]);

  const onDelete = (tasting: Tasting) => {
    setDeletedValues((arr) => [...arr, tasting.id]);
  };

  return (
    <ul className="sm:rounded">
      <AnimatePresence>
        {values
          .filter((t) => deletedValues.indexOf(t.id) === -1)
          .map((tasting) => (
            <TastingListItem
              key={tasting.id}
              tasting={tasting}
              onDelete={onDelete}
              noBottle={noBottle}
            />
          ))}
      </AnimatePresence>
    </ul>
  );
}
