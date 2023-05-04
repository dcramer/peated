import { ElementType, ReactNode } from "react";
import classNames from "../lib/classNames";

export default ({
  as: Component = "div",
  children,
  active,
  onClick,
}: {
  as?: ElementType;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) => {
  return (
    <Component
      className={classNames(
        "[word-wrap: break-word] inline-flex my-[5px] h-[32px] cursor-pointer items-center justify-between rounded-[16px] px-[12px] py-0 text-[13px] font-normal normal-case leading-loose shadow-none transition-[opacity] duration-300 ease-linear hover:!shadow-none border-gray-200 border text-peated",
        active && "bg-peated border-peated text-white"
      )}
      onClick={onClick}
    >
      {children}
    </Component>
  );
};
