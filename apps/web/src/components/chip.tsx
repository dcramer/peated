import { MouseEvent, ReactNode } from "react";
import classNames from "../lib/classNames";
import { motion } from "framer-motion";

type ChipSize = "small" | "base";

export default ({
  children,
  active,
  onClick,
  size = "base",
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  size?: ChipSize;
}) => {
  return (
    <motion.div
      layout
      className={classNames(
        "[word-wrap: break-word] inline-flex items-center justify-between rounded py-0 font-normal normal-case leading-loose shadow-none transition-[opacity] duration-300 ease-linear hover:!shadow-none border-gray-200 border text-peated truncate",
        onClick ? "cursor-pointer hover:bg-gray-200" : "",
        active && "bg-peated hover:bg-peated border-peated text-white",
        size === "small" ? "h-[24px] px-[6px] text-sm" : "h-[32px] px-[12px]"
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};
