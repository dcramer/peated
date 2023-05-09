import { ElementType, ReactNode } from "react";
import classNames from "../lib/classNames";
import { motion } from "framer-motion";

export default ({
  children,
  noHover = false,
  as: Component = "li",
}: {
  children?: ReactNode;
  noHover?: boolean;
  as?: ElementType;
}) => {
  return (
    <Component
      className={classNames(
        "group relative py-5 bg-white",
        noHover ? "" : "hover:bg-gray-100"
      )}
    >
      <motion.div
        className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8"
        layout
      >
        <div className="flex gap-x-4 items-center">{children}</div>
      </motion.div>
    </Component>
  );
};
