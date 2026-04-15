import classNames from "@peated/web/lib/classNames";
import type { ComponentPropsWithoutRef } from "react";

export default function SingleCaskChip({
  className,
}: Pick<ComponentPropsWithoutRef<"span">, "className">) {
  return (
    <span
      className={classNames(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-800/60 bg-amber-950/40 text-[10px] font-semibold uppercase leading-none text-amber-200",
        className,
      )}
      title="Single cask"
    >
      <span aria-hidden="true">S</span>
      <span className="sr-only">Single cask</span>
    </span>
  );
}
