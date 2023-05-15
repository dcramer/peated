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
  active?: boolean;
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
  active = false,
  ...props
}: Props) => {
  const defaultClassName =
    "inline-flex justify-center border items-center text-center rounded font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated";

  let textColor = "text-white";
  if (active) {
    textColor = "text-highlight";
  } else if (disabled) {
    textColor = "text-slate-500";
  }

  let colorClassName;
  switch (color) {
    case "primary":
      colorClassName = classNames(
        disabled
          ? "bg-slate-900 border-slate-900"
          : "bg-slate-800 border-slate-800 hover:bg-slate-700",
      );
      break;
    default:
      colorClassName = classNames(
        disabled
          ? "bg-slate-900 border-slate-900"
          : "bg-slate-900 border-slate-900 hover:bg-slate-800",
      );
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
          disabled ? "cursor-auto" : "",
          textColor,
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
        textColor,
      )}
      type={type || "button"}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};
