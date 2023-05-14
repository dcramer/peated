import { ReactNode } from "react";
import { Link } from "react-router-dom";
import classNames from "../lib/classNames";

type ButtonColor = "primary" | "default" | undefined;

type ButtonSize = "small" | "base";

type BaseProps = {
  color?: ButtonColor;
  icon?: ReactNode;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  className?: string;
};

type ConditionalProps =
  | {
      to?: string;
      onClick?: never;
    }
  | {
      to?: never;
      onClick?: (e: any) => void;
    };

type Props = BaseProps & ConditionalProps;

export default ({
  icon,
  children,
  type,
  to,
  color = "default",
  size = "base",
  fullWidth = false,
  fullHeight = false,
  disabled = false,
  ...props
}: Props) => {
  const defaultClassName =
    "inline-flex justify-center border items-center text-center rounded font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated";

  let colorClassName;
  if (disabled) {
    colorClassName = "cursor-auto text-gray-400 bg-white border-gray-200";
  } else {
    switch (color) {
      case "primary":
        colorClassName =
          "bg-peated border-peated hover:bg-peated-dark text-white";
        break;
      default:
        colorClassName =
          "bg-white border-gray-200 hover:bg-gray-200 text-peated";
    }
  }

  if (to) {
    return (
      <Link
        className={classNames(
          defaultClassName,
          colorClassName,
          icon ? "inline-flex items-center gap-x-1.5" : "",
          size === "small" ? "px-3 py-2 text-xs" : "px-3 py-2 text-sm",
          fullWidth ? "w-full" : "",
          fullHeight ? "h-full" : "",
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
        fullWidth ? "w-full" : "",
        disabled ? "cursor-auto" : "",
      )}
      type={type || "button"}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};
