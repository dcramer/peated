import classNames from "@peated/web/lib/classNames";
import type { ComponentPropsWithoutRef } from "react";
import Chip from "./chip";

export default function SingleCaskChip({
  className,
}: Pick<ComponentPropsWithoutRef<"span">, "className">) {
  return (
    <Chip
      as="span"
      size="small"
      className={classNames("shrink-0 align-middle", className)}
    >
      Single Cask
    </Chip>
  );
}
