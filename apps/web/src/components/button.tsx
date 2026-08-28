import {
  ButtonLink,
  Button as DesignButton,
  type ButtonSize,
  type ButtonVariant,
} from "@peated/web/components/designSystem/components";
import { forwardRef, type ReactNode } from "react";

type ButtonColor = "primary" | "default" | "highlight" | "danger" | undefined;
type LegacyButtonSize = "small" | "base";

type BaseProps = {
  "aria-label"?: string;
  "aria-pressed"?: boolean | "false" | "true" | "mixed";
  active?: boolean;
  children?: ReactNode;
  className?: string;
  color?: ButtonColor;
  disabled?: boolean;
  fullHeight?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  size?: LegacyButtonSize;
  title?: string;
  type?: "button" | "submit" | "reset";
  unstyled?: boolean;
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

function mapSize(size: LegacyButtonSize): ButtonSize {
  return size === "small" ? "sm" : "md";
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    active = false,
    children,
    className: _className,
    color = "default",
    disabled = false,
    fullHeight: _fullHeight,
    fullWidth = false,
    href,
    icon,
    loading = false,
    onClick,
    size = "base",
    type = "button",
    unstyled: _unstyled,
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
});

export default Button;
