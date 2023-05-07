import { ReactNode } from "react";
import classNames from "../lib/classNames";
import { Link } from "react-router-dom";

type ButtonColor = "primary" | "default" | undefined;

type ButtonSize = "small" | "base";

type Props = {
  color?: ButtonColor;
  icon?: ReactNode;
  to?: string;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
  onClick?: (e: any) => void;
  fullWidth?: boolean;
};

export default ({
  icon,
  children,
  type,
  to,
  color = "default",
  size = "base",
  fullWidth = false,
  ...props
}: Props) => {
  const defaultClassName =
    "inline-flex justify-center items-center text-center rounded font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated";

  let colorClassName;
  switch (color) {
    case "primary":
      colorClassName =
        "bg-peated border-peated text-white hover:bg-peated-dark";
      break;
    default:
      colorClassName = "bg-white border-peated text-peated hover:bg-gray-200";
  }

  if (to) {
    return (
      <Link
        className={classNames(
          defaultClassName,
          colorClassName,
          icon ? "inline-flex items-center gap-x-1.5" : "",
          size === "small" ? "px-3 py-2 text-xs" : "px-3 py-2 text-sm",
          fullWidth ? "w-full" : ""
        )}
        to={to}
        {...props}
      >
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classNames(
        defaultClassName,
        colorClassName,
        icon ? "inline-flex items-center gap-x-1.5" : "",
        size === "small" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
        fullWidth ? "w-full" : ""
      )}
      type={type || "button"}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};
