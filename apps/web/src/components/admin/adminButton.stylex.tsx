import { forwardRef, type ReactNode } from "react";
import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "..";

type BaseProps = {
  "aria-label"?: string;
  "aria-pressed"?: boolean | "false" | "true" | "mixed";
  children?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  size?: ButtonSize;
  title?: string;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};

type ConditionalProps =
  | { href?: string; onClick?: never }
  | {
      href?: never;
      onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    };

type Props = BaseProps & ConditionalProps;

export const AdminButton = forwardRef<HTMLButtonElement, Props>(
  function AdminButton(
    {
      children,
      disabled = false,
      fullWidth = false,
      href,
      icon,
      loading = false,
      onClick,
      size = "md",
      type = "button",
      variant = "tonal",
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
    if (href) {
      return (
        <ButtonLink
          {...props}
          aria-disabled={disabled || undefined}
          fullWidth={fullWidth}
          href={disabled ? undefined : href}
          size={size}
          variant={variant}
        >
          {content}
        </ButtonLink>
      );
    }

    return (
      <Button
        {...props}
        disabled={disabled}
        fullWidth={fullWidth}
        loading={loading}
        loadingLabel="Working…"
        onClick={onClick}
        ref={ref}
        size={size}
        type={type}
        variant={variant}
      >
        {content}
      </Button>
    );
  },
);
