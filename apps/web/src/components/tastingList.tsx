import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Tasting } from "../types";
import TastingListItem from "./tastingListItem";

export default ({ values }: { values: Tasting[] }) => {
  const [deletedValues, setDeletedValues] = useState<string[]>([]);

  const onDelete = (tasting: Tasting) => {
    setDeletedValues((arr) => [...arr, tasting.id]);
  };

  return (
    <ul role="list" className="space-y-3">
      <AnimatePresence>
        {values
          .filter((t) => deletedValues.indexOf(t.id) === -1)
          .map((tasting) => (
            <TastingListItem
              key={tasting.id}
              tasting={tasting}
              onDelete={onDelete}
            />
          ))}
      </AnimatePresence>
    </ul>
  );
};
