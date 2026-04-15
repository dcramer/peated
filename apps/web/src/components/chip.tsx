"use client";

import type { PolymorphicProps } from "@peated/web/types";
import { motion } from "framer-motion";
import type { ElementType, MouseEventHandler } from "react";
import classNames from "../lib/classNames";

type ChipSize = "compact" | "small" | "base";

type ChipColor = "default" | "highlight" | "accent";

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
  className,
  ...props
}: PolymorphicProps<E, Props>) {
  const Component = as ?? defaultElement;

  const defaultOnClick = (e: any) => {
    e.preventDefault();
  };

  let colorClass = "";
  switch (color) {
    case "accent":
      colorClass =
        "border-amber-800/60 bg-amber-950/40 text-amber-200 hover:bg-amber-950/60";
      break;
    case "highlight":
      colorClass = "border-highlight text-black bg-highlight";
      break;
    case "default":
    default:
      colorClass = " border-slate-700 text-muted";
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
        size === "compact"
          ? "min-h-[18px] px-1.5 py-0.5 text-[11px] leading-none"
          : size === "small"
            ? "min-h-[24px] px-[6px] text-sm"
            : "min-h-[32px] px-[12px]",
        className,
      )}
      onClick={onClick || defaultOnClick}
      {...props}
      {...moreProps}
    >
      {children}
    </Component>
  );
}
