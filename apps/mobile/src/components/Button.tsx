import theme from "@peated/design";
import classNames from "@peated/mobile/lib/classNames";
import { Slot } from "@radix-ui/react-slot";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

type ButtonVariant = "primary" | "default" | "highlight" | undefined;

type ButtonSize = "small" | "base";

type ButtonProps = {
  asChild?: boolean;
  variant?: ButtonVariant;
  icon?: any;
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  className?: string;
  title?: string;
};

export default function Button({
  asChild,
  icon,
  children,
  type,
  variant = "default",
  size = "base",
  fullWidth = false,
  fullHeight = false,
  disabled = false,
  loading = false,
  active = false,
  ...props
}: ButtonProps) {
  const defaultClassName =
    "inline-flex spacing-2-x justify-center border items-center text-center rounded font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated";

  let textColor: keyof (typeof theme)["colors"] = "white";
  let colorClassName;
  switch (variant) {
    case "highlight":
      colorClassName = classNames(
        disabled
          ? "bg-highlight border-highlight"
          : "bg-highlight border-highlight",
      );
      textColor = "text-black";
      break;
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

  if (active) {
    textColor = "highlight";
  } else if (disabled) {
    textColor = variant === "highlight" ? "highlight-dark" : "light";
  }

  const Element = asChild ? Slot : Text;
  const Icon = icon;

  return (
    <View
      className={classNames(
        defaultClassName,
        colorClassName,
        "flex flex-row items-center justify-center gap-x-1.5",
        size === "small" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
        fullWidth ? "w-full" : "",
        disabled ? "cursor-auto" : "cursor-pointer",
        loading ? "animate-pulse" : "",
      )}
    >
      {icon ? (
        <Icon
          size={18}
          style={{
            color: theme.colors[textColor],
          }}
        />
      ) : null}
      <Element
        className={classNames(
          defaultClassName,
          colorClassName,
          "flex flex-row items-center justify-center gap-x-1.5",
          size === "small" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
          fullWidth ? "w-full" : "",
          disabled ? "cursor-auto" : "cursor-pointer",
          loading ? "animate-pulse" : "",
        )}
        style={{
          color: theme.colors[textColor] as string,
        }}
        {...props}
      >
        {children}
      </Element>
    </View>
  );
}
