import { forwardRef, type ReactNode } from "react";
import {
  ButtonLink,
  Button as DesignButton,
  type ButtonSize,
  type ButtonVariant,
} from "..";

type ButtonColor = "primary" | "default" | "highlight" | "danger" | undefined;
type AdminButtonSize = "small" | "base";

type BaseProps = {
  "aria-label"?: string;
  "aria-pressed"?: boolean | "false" | "true" | "mixed";
  active?: boolean;
  children?: ReactNode;
  color?: ButtonColor;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  size?: AdminButtonSize;
  title?: string;
  type?: "button" | "submit" | "reset";
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};

type ConditionalProps =
  | { href?: string; onClick?: never }
  | {
      href?: never;
      onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    };

type Props = BaseProps & ConditionalProps;

function mapVariant(color: ButtonColor, active: boolean): ButtonVariant {
  if (color === "highlight" || active) return "accent";
  if (color === "danger") return "danger";
  if (color === "primary") return "default";
  return "tonal";
}

function mapSize(size: AdminButtonSize): ButtonSize {
  return size === "small" ? "sm" : "md";
}

export const AdminButton = forwardRef<HTMLButtonElement, Props>(
  function AdminButton(
    {
      active = false,
      children,
      color = "default",
      disabled = false,
      fullWidth = false,
      href,
      icon,
      loading = false,
      onClick,
      size = "base",
      type = "button",
      ...props
    },
    ref,
  ) {
    const content = (
      <>
        {icon}
        {children}
      </>
    );
    const variant = mapVariant(color, active);

    if (href) {
      return (
        <ButtonLink
          {...props}
          aria-disabled={disabled || undefined}
          fullWidth={fullWidth}
          href={disabled ? undefined : href}
          size={mapSize(size)}
          variant={variant}
        >
          {content}
        </ButtonLink>
      );
    }

    return (
      <DesignButton
        {...props}
        disabled={disabled}
        fullWidth={fullWidth}
        loading={loading}
        loadingLabel="Working…"
        onClick={onClick}
        ref={ref}
        size={mapSize(size)}
        type={type}
        variant={variant}
      >
        {content}
      </DesignButton>
    );
  },
);
