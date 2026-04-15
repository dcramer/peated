import classNames from "@peated/web/lib/classNames";
import type { ComponentPropsWithoutRef } from "react";
import Chip from "./chip";

export default function SingleCaskChip({
  className,
}: Pick<ComponentPropsWithoutRef<"span">, "className">) {
  return (
    <Chip
      as="span"
      size="compact"
      color="accent"
      className={classNames(
        "shrink-0 !justify-start gap-1 rounded-full font-medium",
        className,
      )}
      title="Single cask"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300/90" />
      <span>Single Cask</span>
    </Chip>
  );
}
