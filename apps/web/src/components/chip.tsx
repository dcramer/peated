import { motion } from "framer-motion";
import type React from "react";
import classNames from "../lib/classNames";
import { Slot } from "./slot";

type ChipSize = "small" | "base";

type ChipColor = "default" | "highlight";

type Props = {
  active?: boolean;
  color?: ChipColor;
  size?: ChipSize;
  asChild?: boolean;
  children?: React.ReactNode;
  onClick?: (e: any) => void;
} & React.ComponentPropsWithoutRef<"li">;

export default function Chip({
  children,
  active,
  onClick,
  size = "base",
  color = "default",
  asChild = false,
  className,
  ...props
}: Props) {
  const defaultOnClick = (e: any) => {
    e.preventDefault();
  };

  let colorClass = "";
  switch (color) {
    case "highlight":
      colorClass = "border-highlight text-black bg-highlight";
      break;
    default:
      colorClass = " border-slate-700 text-muted";
  }

  const chipClassName = classNames(
    "break-word] hover:!shadow-none inline-flex items-center justify-between truncate rounded border py-0 font-normal normal-case leading-loose shadow-none transition-[opacity] duration-300 ease-linear [word-wrap:",
    onClick ? "cursor-pointer hover:bg-slate-800" : "",
    active
      ? "border-slate-700 bg-slate-700 text-white hover:bg-slate-700"
      : colorClass,
    size === "small"
      ? "min-h-[24px] px-[6px] text-sm"
      : "min-h-[32px] px-[12px]",
    className
  );

  if (asChild) {
    return (
      <Slot className={chipClassName} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <motion.li
      layout
      className={chipClassName}
      onClick={onClick || defaultOnClick}
    >
      {children}
    </motion.li>
  );
}
