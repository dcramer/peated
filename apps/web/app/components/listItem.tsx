import { motion } from "framer-motion";
import type { ElementType } from "react";
import type { PolymorphicProps } from "~/types";
import classNames from "../lib/classNames";

type Props = {
  noHover?: boolean;
  color?: "default" | "highlight";
};

const defaultElement = motion.div;

export default function ListItem<
  E extends ElementType = typeof defaultElement,
>({
  children,
  noHover = false,
  color = "default",
  as,
  ...props
}: PolymorphicProps<E, Props>) {
  const Component = as ?? defaultElement;
  return (
    <Component
      className={classNames(
        "card group relative",
        color === "highlight" ? "bg-highlight text-black" : "",
        noHover ? "" : color === "highlight" ? "" : "hover:bg-slate-900",
      )}
      {...props}
    >
      <div className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
        <div className="card-body flex items-center gap-x-4">{children}</div>
      </div>
    </Component>
  );
}
