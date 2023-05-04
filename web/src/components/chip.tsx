import { ElementType, ReactNode } from "react";
import classNames from "../lib/classNames";

type ChipSize = "small" | "base";

export default ({
  as: Component = "div",
  children,
  active,
  onClick,
  size = "base",
}: {
  as?: ElementType;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  size: ChipSize;
}) => {
  return (
    <Component
      className={classNames(
        "[word-wrap: break-word] inline-flex items-center justify-between rounded py-0 font-normal normal-case leading-loose shadow-none transition-[opacity] duration-300 ease-linear hover:!shadow-none border-gray-200 border text-peated",
        onClick ? "cursor-pointer hover:bg-gray-200" : "",
        active && "bg-peated hover:bg-peated border-peated text-white",
        size === "small"
          ? "h-[24px] px-[6px] text-xs"
          : "h-[32px] px-[12px] text-sm"
      )}
      onClick={onClick}
    >
      {children}
    </Component>
  );
};
