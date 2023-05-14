import { motion } from "framer-motion";
import { MouseEvent, ReactNode } from "react";
import classNames from "../lib/classNames";

type ChipSize = "small" | "base";

export default ({
  children,
  active,
  onClick,
  size = "base",
  ...props
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  size?: ChipSize;
} & React.ComponentPropsWithoutRef<typeof motion.div>) => {
  return (
    <motion.div
      layout
      className={classNames(
        "[word-wrap: break-word] text-peated inline-flex items-center justify-between truncate rounded border border-gray-200 py-0 font-normal normal-case leading-loose shadow-none transition-[opacity] duration-300 ease-linear hover:!shadow-none",
        onClick ? "cursor-pointer hover:bg-gray-200" : "",
        active && "bg-peated hover:bg-peated border-peated text-white",
        size === "small" ? "h-[24px] px-[6px] text-sm" : "h-[32px] px-[12px]",
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.div>
  );
};
