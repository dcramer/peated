import { ReactNode } from "react";
import classNames from "../lib/classNames";

type ButtonColor = "primary" | "default" | undefined;

type Props = React.ComponentPropsWithoutRef<"button"> & {
  color?: ButtonColor;
  icon?: ReactNode;
};

export default ({ color, icon, children, ...props }: Props) => {
  const defaultClassName =
    "inline-flex justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated";

  let colorClassName;
  switch (color) {
    case "primary":
      colorClassName =
        "bg-peated border-peated text-white hover:bg-peated-dark";
      break;
    default:
      colorClassName = "bg-white border-peated text-peated hover:bg-gray-200";
  }

  return (
    <button
      className={classNames(
        defaultClassName,
        colorClassName,
        icon ? "inline-flex items-center gap-x-1.5" : ""
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};
