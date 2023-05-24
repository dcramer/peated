import { motion } from "framer-motion";
import { ElementType } from "react";
import classNames from "../lib/classNames";
import { PolymorphicProps } from "../types";

type Props<E extends ElementType> = PolymorphicProps<E> & {
  noHover?: boolean;
  color?: "default" | "highlight";
};

const defaultElement = motion.div;

export default function ListItem<
  E extends ElementType = typeof defaultElement,
>({ children, noHover = false, color = "default", as, ...props }: Props<E>) {
  const Component = as ?? defaultElement;
  return (
    <Component
      className={classNames(
        "card group relative",
        color === "highlight" ? "bg-highlight text-black" : "",
        noHover ? "" : color === "highlight" ? "" : "hover:bg-slate-900",
      )}
    >
      <div className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
        <div className="card-body flex items-center gap-x-4">{children}</div>
      </div>
    </Component>
  );
}
