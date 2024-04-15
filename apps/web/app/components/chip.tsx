import type { PolymorphicProps } from "@peated/web/types";
import { motion } from "framer-motion";
import type { ElementType } from "react";
import classNames from "../lib/classNames";

type ChipSize = "small" | "base";

type ChipColor = "default" | "highlight";

type Props = {
  active?: boolean;
  color?: ChipColor;
  size?: ChipSize;
};

const defaultElement = motion.li;

export default function Chip<E extends ElementType = typeof defaultElement>({
  children,
  active,
  onClick,
  size = "base",
  color = "default",
  as,
  ...props
}: PolymorphicProps<E, Props>) {
  const Component = as ?? defaultElement;

  let colorClass = "";
  switch (color) {
    case "highlight":
      colorClass = "border-highlight text-black bg-highlight";
      break;
    case "default":
    default:
      colorClass = " border-slate-700 text-light";
  }

  const moreProps = Component === defaultElement ? { layout: true } : {};

  return (
    <Component
      className={classNames(
        "[word-wrap: break-word] inline-flex items-center justify-between truncate rounded border py-0 font-normal normal-case leading-loose shadow-none transition-[opacity] duration-300 ease-linear hover:!shadow-none",
        onClick ? "cursor-pointer hover:bg-slate-800" : "",
        active
          ? "border-slate-700 bg-slate-700 text-white hover:bg-slate-700"
          : colorClass,
        size === "small"
          ? "min-h-[24px] px-[6px] text-sm"
          : "min-h-[32px] px-[12px]",
      )}
      onClick={onClick}
      {...props}
      {...moreProps}
    >
      {children}
    </Component>
  );
}
